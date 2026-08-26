/**
 * Идемпотентные обёртки («сначала проверь, потом делай») над REST API
 * Google Cloud / Firebase для провижининга нового Firebase-проекта,
 * которым владеет покупатель.
 *
 * Каждый шаг СПЕРВА проверяет фактическое состояние ресурса и выполняет
 * мутацию, только если её действительно не хватает; гонка мутации с более
 * ранним запуском («already exists» / 409) считается успехом. В связке с
 * автоматическим ретраем транзиентных ошибок в googleApiClient.ts это
 * делает весь конвейер безопасно перезапускаемым после частичного сбоя на
 * середине (прежняя best-effort версия падала на ошибках «already exists»
 * и даже плодила дубликаты web app при ретрае).
 *
 * Каждый вызов выполняется с СОБСТВЕННЫМ OAuth access token покупателя
 * (elevated scopes: cloud-platform + firebase) — создаваемый проект
 * принадлежит ему и идёт по его биллингу, а не нашему.
 */
import { callGoogleApi } from './googleApiClient.js';
import { isGoogleApiStatus } from './retry.js';

export interface WebAppConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

interface LongRunningOperation {
  done?: boolean;
  name?: string;
  error?: { message: string };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function pollOperation(accessToken: string, operationUrl: string): Promise<void> {
  for (let attempt = 0; attempt < 45; attempt++) {
    const op = await callGoogleApi<LongRunningOperation>(accessToken, operationUrl);
    if (op.done) {
      if (op.error) throw new Error(`Operation failed: ${op.error.message}`);
      return;
    }
    await sleep(2000);
  }
  throw new Error(`Timed out waiting for operation ${operationUrl}`);
}

/**
 * Свежесозданный ресурс (проект/Firebase-обёртка) может временно отдавать
 * 403 «Permission denied (or it may not exist)», пока привязки IAM нового
 * проекта распространяются по облаку. Повторяем GET до появления ресурса,
 * реагируя только на 403; прочие ошибки, включая честную 404 («точно нет»),
 * пробрасываются сразу, чтобы не тормозить основной путь создания.
 */
async function retryGetWhileForbidden<T = unknown>(
  accessToken: string,
  url: string,
  attempts = 15,
  delayMs = 4000,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await callGoogleApi<T>(accessToken, url);
    } catch (error) {
      lastError = error;
      if (!isGoogleApiStatus(error, 403)) throw error;
      await sleep(delayMs);
    }
  }
  throw lastError;
}

/** Создаёт GCP-проект покупателя, если его ещё нет.
 *
 *  ВАЖНО: решаем идемпотентность БЕЗ предварительного GET-пробы. Для
 *  несуществующего проекта API отвечает на GET не 404, а 403 PERMISSION_DENIED
 *  («or it may not exist») — у токена нет прав на отсутствующий ресурс, и
 *  отличить «проекта нет» от «нет доступа» невозможно. Поэтому всегда пробуем
 *  создать, а гонку с уже существующим проектом гасим по 409 ALREADY_EXISTS,
 *  после чего дожидаемся его видимости для токена. */
export async function ensureGoogleCloudProject(
  accessToken: string,
  projectId: string,
  displayName: string,
): Promise<void> {
  const getUrl = `https://cloudresourcemanager.googleapis.com/v3/projects/${projectId}`;

  try {
    const op = await callGoogleApi<{ name: string }>(
      accessToken,
      'https://cloudresourcemanager.googleapis.com/v3/projects',
      { method: 'POST', body: JSON.stringify({ projectId, displayName }) },
    );
    await pollOperation(accessToken, `https://cloudresourcemanager.googleapis.com/v3/${op.name}`);
  } catch (error) {
    // 409: проект уже существует (создан ранее прервавшимся запуском).
    // Подтверждаем, что он виден токену, и продолжаем конвейер.
    if (!isGoogleApiStatus(error, 409)) throw error;
    await retryGetWhileForbidden(accessToken, getUrl);
  }
}

/** Включает нужные сервисы Google. batchEnable сам по себе идемпотентен;
 *  но, в отличие от старой версии, мы теперь ЖДЁМ завершения его long-running
 *  операции, чтобы последующие шаги не ловили «API not enabled». Если всё уже
 *  включено, API отвечает пустой операцией — ждать нечего. */
export async function ensureServicesEnabled(accessToken: string, projectId: string): Promise<void> {
  const services = [
    'firestore.googleapis.com',
    'identitytoolkit.googleapis.com',
    'firebaserules.googleapis.com',
  ];
  const op = await callGoogleApi<LongRunningOperation>(
    accessToken,
    `https://serviceusage.googleapis.com/v1/projects/${projectId}/services:batchEnable`,
    { method: 'POST', body: JSON.stringify({ serviceIds: services }) },
  );
  if (op.name) await pollOperation(accessToken, `https://serviceusage.googleapis.com/v1/${op.name}`);
}

/** Подключает Firebase к GCP-проекту покупателя, если тот ещё им не является.
 *  Без предварительной пробы по тем же причинам, что и у создания проекта:
 *  409 от addFirebase трактуем как «Firebase уже подключён». */
export async function ensureFirebaseAdded(accessToken: string, projectId: string): Promise<void> {
  try {
    const op = await callGoogleApi<{ name: string }>(
      accessToken,
      `https://firebase.googleapis.com/v1beta1/projects/${projectId}:addFirebase`,
      { method: 'POST' },
    );
    await pollOperation(accessToken, `https://firebase.googleapis.com/v1beta1/${op.name}`);
  } catch (error) {
    // 409: этот GCP-проект уже подключён к Firebase более ранним запуском.
    if (!isGoogleApiStatus(error, 409)) throw error;
  }
}

/** Создаёт нативную базу Firestore `(default)` покупателя, если её ещё нет.
 *  Без предварительной пробы по тем же причинам, что и у проекта: 409
 *  ALREADY_EXISTS трактуем как «база уже есть». */
export async function ensureFirestoreDatabase(
  accessToken: string,
  projectId: string,
  locationId: string,
): Promise<void> {
  try {
    const op = await callGoogleApi<LongRunningOperation>(
      accessToken,
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases?databaseId=(default)`,
      { method: 'POST', body: JSON.stringify({ type: 'FIRESTORE_NATIVE', locationId }) },
    );
    if (op.name) await pollOperation(accessToken, `https://firestore.googleapis.com/v1/${op.name}`);
  } catch (error) {
    // 409 ALREADY_EXISTS: сюда раньше добежал другой запуск.
    if (!isGoogleApiStatus(error, 409)) throw error;
  }
}

interface WebAppSummary {
  name: string;
  displayName?: string;
}

/** Предпочитает НАШЕ приложение по displayName, но берёт любое существующее
 *  web-приложение — после частичного сбоя там уже может лежать ровно одно,
 *  и его надо переиспользовать, а не дублировать. */
async function findExistingWebApp(
  accessToken: string,
  projectId: string,
  displayName: string,
): Promise<WebAppSummary | undefined> {
  const apps = await callGoogleApi<{ apps?: WebAppSummary[] }>(
    accessToken,
    `https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps`,
  );
  const list = apps.apps ?? [];
  return list.find((app) => app.displayName === displayName) ?? list[0];
}

async function fetchWebAppConfig(accessToken: string, appName: string): Promise<WebAppConfig> {
  return callGoogleApi<WebAppConfig>(
    accessToken,
    `https://firebase.googleapis.com/v1beta1/${appName}/config`,
  );
}

/**
 * Возвращает SDK-конфиг FlowLedger web app, создавая его ТОЛЬКО если web-
 * приложений ещё нет. Старый createWebApp слепо создавал новое приложение
 * на каждом ретрае; эта версия переиспользует то, что успел создать
 * предыдущий частичный запуск.
 */
export async function ensureWebApp(
  accessToken: string,
  projectId: string,
  displayName: string,
): Promise<WebAppConfig> {
  const existing = await findExistingWebApp(accessToken, projectId, displayName);
  if (existing) return fetchWebAppConfig(accessToken, existing.name);

  try {
    const op = await callGoogleApi<{ name: string }>(
      accessToken,
      `https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps`,
      { method: 'POST', body: JSON.stringify({ displayName }) },
    );
    await pollOperation(accessToken, `https://firebase.googleapis.com/v1beta1/${op.name}`);
  } catch (error) {
    // 409: более ранний запуск создал приложение между нашим списком и этим create.
    if (!isGoogleApiStatus(error, 409)) throw error;
  }

  const app = await findExistingWebApp(accessToken, projectId, displayName);
  if (!app) throw new Error('Web app was not created');
  return fetchWebAppConfig(accessToken, app.name);
}

/** Включает Google Sign-In в проекте покупателя.
 *
 *  Нюанс: у свежесозданного проекта НЕТ корневой конфигурации Identity Toolkit
 *  (projects/{id}/config), и надёжного публичного «создать конфиг» нет:
 *  - PATCH по отсутствующему конфигу отвечает 404 CONFIGURATION_NOT_FOUND;
 *  - проектная вариация accounts:signUp не существует (HTML 404);
 *  - инициализацию пытаемся вызвать клиентским signUp с API-ключом web app
 *    (анонимная учётка; побочный эффект вызова — создание конфигурации).
 *  Если Google всё равно не даёт создать конфиг программно (антиабьюз),
 *  бросаем понятную ошибку со ссылкой на разовое ручное включение. */
export async function ensureGoogleSignInEnabled(
  accessToken: string,
  projectId: string,
  webApiKey: string,
): Promise<void> {
  const base = `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}`;

  // Шаг 1: попытка инициализации Identity Toolkit клиентским signUp.
  try {
    await callGoogleApi(accessToken, `${base}/config`);
    // Конфигурация уже существует — инициализация не требуется.
  } catch {
    // Ошибку этого вызова сознательно глотаем: если инициализация через
    // ключ невозможна, ниже будет выброшена подробная инструкция.
    try {
      await callGoogleApi(
        accessToken,
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${webApiKey}`,
        { method: 'POST', body: JSON.stringify({}) },
      );
    } catch {
      /* игнорируем — диагностику делает следующий PATCH */
    }
  }

  // Шаг 2: корневой конфиг (идемпотентный патч).
  try {
    await callGoogleApi(accessToken, `${base}/config?updateMask=signIn`, {
      method: 'PATCH',
      body: JSON.stringify({ signIn: { allowDuplicateEmails: false } }),
    });
  } catch (error) {
    if (isGoogleApiStatus(error, 404)) {
      throw new Error(
        `Не удалось программно инициализировать аутентификацию в проекте ${projectId}: ` +
          'Google требует разовую активацию Authentication в консоли этого проекта. ' +
          `Откройте https://console.firebase.google.com/project/${projectId}/authentication ` +
          '→ «Get started», затем нажмите «Повторить». Остальные шаги провижининга уже выполнены.',
      );
    }
    throw error;
  }

  const configUrl = `${base}/defaultSupportedIdpConfigs/google.com`;

  try {
    const config = await callGoogleApi<{ enabled?: boolean }>(accessToken, configUrl);
    if (config.enabled) return;
    // Уже существует, просто выключен — PATCH обновляет существующий ресурс.
    // Поле idpId в payload невалидно для PATCH (идентификатор провайдера уже
    // в URL) — Google отвечает 400 «Unknown name "idpId"».
    await callGoogleApi(accessToken, `${configUrl}?updateMask=enabled`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled: true }),
    });
    return;
  } catch (error) {
    // 404: дочернего конфига для google.com ещё нет — его нужно СОЗДАТЬ
    // (POST в коллекцию), PATCH создать ресурс не может.
    if (!isGoogleApiStatus(error, 404)) throw error;
  }

  try {
    await callGoogleApi(accessToken, `${base}/defaultSupportedIdpConfigs?idpId=google.com`, {
      method: 'POST',
      body: JSON.stringify({ enabled: true }),
    });
  } catch (error) {
    if (isGoogleApiStatus(error, 400)) {
      // "client_id cannot be empty": для провайдера google.com Google выдаёт
      // OAuth client_id только через внутренний (непубличный) механизм консоли
      // Firebase — публичный Identity Toolkit API создать его не может.
      // Программной альтернативы нет, разово включаем вручную.
      throw new Error(
        `Не удалось программно включить вход через Google в проекте ${projectId}: ` +
          'Google выдаёт OAuth client_id для провайдера "Google" только через консоль. ' +
          `Откройте https://console.firebase.google.com/project/${projectId}/authentication/providers ` +
          '→ включите провайдер Google → «Сохранить», затем нажмите «Повторить». ' +
          'Остальные шаги провижининга уже выполнены.',
      );
    }
    // 409: конфиг создан конкурентно между нашим GET и этим POST — включаем PATCH-ом.
    if (!isGoogleApiStatus(error, 409)) throw error;
    await callGoogleApi(accessToken, `${configUrl}?updateMask=enabled`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled: true }),
    });
  }
}
