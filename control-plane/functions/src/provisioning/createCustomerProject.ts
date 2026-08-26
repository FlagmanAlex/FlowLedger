import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from '../admin.js';
import {
  ensureFirebaseAdded,
  ensureFirestoreDatabase,
  ensureGoogleCloudProject,
  ensureGoogleSignInEnabled,
  ensureServicesEnabled,
  ensureWebApp,
  type WebAppConfig,
} from './googleCloudClient.js';
import { deployFirestoreIndexes, deployFirestoreRules } from './deployRules.js';

interface CreateCustomerProjectPayload {
  /** OAuth access token со scope cloud-platform + firebase, полученный
   *  на клиенте вторым, инкрементальным Google-согласием. */
  accessToken: string;
  firestoreLocationId?: string;
}

/** Зеркалит @flowledger/interfaces ProvisioningSteps — пакет functions
 *  сознательно не зависит от workspace interfaces. */
type ProvisioningSteps = Partial<
  Record<
    | 'projectCreated'
    | 'servicesEnabled'
    | 'firebaseAdded'
    | 'firestoreCreated'
    | 'webAppCreated'
    | 'signInEnabled'
    | 'rulesDeployed'
    | 'indexesDeployed',
    boolean
  >
>;

interface CustomerRecordSnapshot {
  status?: 'provisioning' | 'ready' | 'failed';
  projectId?: string;
  firebaseConfig?: WebAppConfig;
  error?: string;
  createdAt?: string;
  readyAt?: string;
  updatedAt?: string;
  steps?: ProvisioningSteps;
}

function customerProjectId(uid: string): string {
  // Идентификаторы облачных проектов: 6-30 символов, строчные буквы/цифры/дефисы.
  return `flowledger-${uid.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16)}`;
}

/** Запись 'provisioning', чей heartbeat (updatedAt) свежее этого значения,
 *  означает, что другой вызов, скорее всего, ещё исполняется — дублирующий
 *  вызов НЕ должен запускать второй пайплайн поверх него. Протухший
 *  heartbeat → прошлый запуск умер на середине, и этот вызов продолжит
 *  работу по записанным чекпоинтам. */
const PROVISIONING_HEARTBEAT_TTL_MS = 10 * 60 * 1000;

/**
 * Оркестрация создания нового Firebase-проекта, которым владеет покупатель,
 * и его подготовки к работе FlowLedger: база Firestore Native,
 * зарегистрированное Web-приложение (ради его SDK-конфига), включённый
 * Google Sign-In и задеплоенные Security Rules/индексы продукта. Всё
 * исполняется против квот/биллинга ВЫЗЫВАЮЩЕГО через его собственный
 * OAuth-токен — сама функция лишь читает/пишет документ статуса
 * `customers/{uid}` контрольной плоскости через Admin SDK.
 *
 * Полностью перезапускаем после частичного сбоя:
 * - каждый удалённый шаг идемпотентен по схеме «проверь, затем сделай»
 *   (см. googleCloudClient.ts);
 * - каждый завершённый шаг чекпоинтится в `customers/{uid}.steps`, поэтому
 *   ретрай сразу перепрыгивает уже применённое на удалённой стороне;
 * - свежий heartbeat в статусе 'provisioning' заставляет параллельные
 *   дубли вызова ждать вместо двойного провижининга; протухший — разрешает
 *   следующему вызову возобновить работу.
 */
export const createCustomerProject = onCall<CreateCustomerProjectPayload>(
  { timeoutSeconds: 540 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }
    const uid = request.auth.uid;
    const { accessToken, firestoreLocationId = 'us-central' } = request.data;
    if (!accessToken) {
      throw new HttpsError('invalid-argument', 'Missing accessToken.');
    }

    const customerRef = db.collection('customers').doc(uid);
    const existing = (await customerRef.get()).data() as CustomerRecordSnapshot | undefined;

    // Полностью провижинено ранее — возвращаем сохранённый конфиг без изменений.
    if (existing?.status === 'ready') {
      return existing;
    }

    if (existing?.status === 'provisioning') {
      const updatedAtMs = Date.parse(existing.updatedAt ?? '');
      const heartbeatFresh =
        Number.isFinite(updatedAtMs) && Date.now() - updatedAtMs < PROVISIONING_HEARTBEAT_TTL_MS;
      if (heartbeatFresh) {
        // Параллельный дублирующий вызов: сообщаем текущее состояние; UI
        // следит за прогрессом через свой onSnapshot-слушатель customers/{uid}.
        return existing;
      }
      // Протухший heartbeat — прошлый запуск умер на середине; продолжаем ниже.
    }

    const projectId = customerProjectId(uid);
    const steps: ProvisioningSteps = existing?.steps ?? {};
    const now = () => new Date().toISOString();

    await customerRef.set(
      {
        status: 'provisioning',
        projectId,
        ...(existing?.createdAt ? null : { createdAt: now() }),
        updatedAt: now(),
        steps,
      },
      { merge: true },
    );

    /** Долговременный чекпоинт одного шага конвейера плюс любые
     *  дополнительные поля записи, созданные этим шагом (например, firebaseConfig). */
    const completeStep = async (
      step: keyof ProvisioningSteps,
      extra: Record<string, unknown> = {},
    ): Promise<void> => {
      steps[step] = true;
      await customerRef.set(
        { steps: { [step]: true }, updatedAt: now(), ...extra },
        { merge: true },
      );
    };

    try {
      if (!steps.projectCreated) {
        await ensureGoogleCloudProject(accessToken, projectId, 'FlowLedger');
        await completeStep('projectCreated');
      }
      if (!steps.servicesEnabled) {
        await ensureServicesEnabled(accessToken, projectId);
        await completeStep('servicesEnabled');
      }
      if (!steps.firebaseAdded) {
        await ensureFirebaseAdded(accessToken, projectId);
        await completeStep('firebaseAdded');
      }
      if (!steps.firestoreCreated) {
        await ensureFirestoreDatabase(accessToken, projectId, firestoreLocationId);
        await completeStep('firestoreCreated');
      }

      // Сохраняем firebaseConfig СРАЗУ после появления web app — поздние шаги
      // могут упасть, но конфиг не должен ни потеряться, ни создаться заново.
      let webAppConfig = existing?.firebaseConfig;
      if (!steps.webAppCreated || !webAppConfig) {
        webAppConfig = await ensureWebApp(accessToken, projectId, 'FlowLedger Web');
        await completeStep('webAppCreated', { firebaseConfig: webAppConfig });
      }

      if (!steps.signInEnabled) {
        await ensureGoogleSignInEnabled(accessToken, projectId);
        await completeStep('signInEnabled');
      }
      // Деплой Rules естественно идемпотентен (release → новейший ruleset),
      // но при проставленном чекпоинте пропуск избавляет от лишних вызовов API.
      if (!steps.rulesDeployed) {
        await deployFirestoreRules(accessToken, projectId);
        await completeStep('rulesDeployed');
      }
      if (!steps.indexesDeployed) {
        await deployFirestoreIndexes(accessToken, projectId);
        await completeStep('indexesDeployed');
      }

      const record = {
        status: 'ready' as const,
        projectId,
        firebaseConfig: webAppConfig!,
        readyAt: now(),
        updatedAt: now(),
        steps,
      };
      await customerRef.set(record, { merge: true });
      return record;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await customerRef.set(
        { status: 'failed', error: message, updatedAt: now() },
        { merge: true },
      );
      throw new HttpsError('internal', 'Provisioning failed', { message });
    }
  },
);
