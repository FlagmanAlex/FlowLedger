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

/** Создаёт GCP-проект, если он ещё не существует (например, после более
 *  раннего частично упавшего запуска, чья запись так и не попала в Firestore). */
export async function ensureGoogleCloudProject(
  accessToken: string,
  projectId: string,
  displayName: string,
): Promise<void> {
  const getUrl = `https://cloudresourcemanager.googleapis.com/v3/projects/${projectId}`;

  try {
    await callGoogleApi(accessToken, getUrl);
    return; // Уже существует (и виден) — делать нечего.
  } catch (error) {
    if (!isGoogleApiStatus(error, 404)) throw error;
  }

  try {
    const op = await callGoogleApi<{ name: string }>(
      accessToken,
      'https://cloudresourcemanager.googleapis.com/v3/projects',
      { method: 'POST', body: JSON.stringify({ projectId, displayName }) },
    );
    await pollOperation(accessToken, `https://cloudresourcemanager.googleapis.com/v3/${op.name}`);
  } catch (error) {
    // 409: конкурентный/более ранний запуск создал проект между нашей пробой
    // и этим create. Подтверждаем, что он реально виден, иначе пробрасываем ошибку.
    if (!isGoogleApiStatus(error, 409)) throw error;
    await callGoogleApi(accessToken, getUrl);
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

/** Добавляет Firebase к GCP-проекту, если тот ещё не является Firebase-проектом. */
export async function ensureFirebaseAdded(accessToken: string, projectId: string): Promise<void> {
  const getUrl = `https://firebase.googleapis.com/v1beta1/projects/${projectId}`;

  try {
    await callGoogleApi(accessToken, getUrl);
    return;
  } catch (error) {
    if (!isGoogleApiStatus(error, 404)) throw error;
  }

  try {
    const op = await callGoogleApi<{ name: string }>(
      accessToken,
      `${getUrl}:addFirebase`,
      { method: 'POST' },
    );
    await pollOperation(accessToken, `https://firebase.googleapis.com/v1beta1/${op.name}`);
  } catch (error) {
    // 409: addFirebase состязался с более ранним запуском, который уже применился.
    if (!isGoogleApiStatus(error, 409)) throw error;
    await callGoogleApi(accessToken, getUrl);
  }
}

/** Создаёт нативную базу Firestore `(default)`, если её ещё нет. */
export async function ensureFirestoreDatabase(
  accessToken: string,
  projectId: string,
  locationId: string,
): Promise<void> {
  const dbUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)`;

  try {
    await callGoogleApi(accessToken, dbUrl);
    return;
  } catch (error) {
    if (!isGoogleApiStatus(error, 404)) throw error;
  }

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

/** Включает Google Sign-In, если он ещё не включён; сам PATCH идемпотентен,
 *  GET лишь избавляет от бессмысленной записи. */
export async function ensureGoogleSignInEnabled(
  accessToken: string,
  projectId: string,
): Promise<void> {
  const configUrl =
    `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}` +
    '/defaultSupportedIdpConfigs/google.com';

  try {
    const config = await callGoogleApi<{ enabled?: boolean }>(accessToken, configUrl);
    if (config.enabled) return;
  } catch (error) {
    // Ещё не сконфигурировано (404) либо Identity Toolkit ещё «устаканивается»
    // сразу после включения — источником правды в любом случае является PATCH ниже.
    if (!isGoogleApiStatus(error, 404, 400, 403)) throw error;
  }

  await callGoogleApi(accessToken, configUrl, {
    method: 'PATCH',
    body: JSON.stringify({ enabled: true, idpId: 'google.com' }),
  });
}
