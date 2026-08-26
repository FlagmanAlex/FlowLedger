/**
 * Idempotent ("verify-then-act") wrappers over the Google Cloud / Firebase
 * REST APIs used to provision a brand-new, customer-owned Firebase project.
 *
 * Every step FIRST probes the live state of the resource and only performs
 * the mutation when it is genuinely missing; a mutation racing with an
 * earlier run ("already exists" / 409) is treated as success. Combined with
 * the automatic transient-error retry in googleApiClient.ts this makes the
 * whole pipeline safely re-runnable after a partial failure mid-way (the
 * previous best-effort version crashed on "already exists" errors and even
 * created duplicate web apps on retry).
 *
 * Every call is made with the CUSTOMER's own OAuth access token (elevated
 * scopes: cloud-platform + firebase) — the resulting project is theirs, on
 * their billing, not ours.
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

/** Creates the GCP project unless it already exists (e.g. from an earlier
 *  partially-failed run whose record never reached Firestore). */
export async function ensureGoogleCloudProject(
  accessToken: string,
  projectId: string,
  displayName: string,
): Promise<void> {
  const getUrl = `https://cloudresourcemanager.googleapis.com/v3/projects/${projectId}`;

  try {
    await callGoogleApi(accessToken, getUrl);
    return; // Already exists (and is visible) — nothing to do.
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
    // 409: a concurrent/earlier run created it between our probe and this
    // create. Confirm it is really visible now, otherwise surface the error.
    if (!isGoogleApiStatus(error, 409)) throw error;
    await callGoogleApi(accessToken, getUrl);
  }
}

/** Enables required Google services. batchEnable is idempotent by itself;
 *  unlike the old version we now WAIT for its long-running operation so
 *  subsequent steps don't hit "API not enabled". An already-enabled set
 *  answers with an empty operation — nothing to wait for then. */
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

/** Adds Firebase to the GCP project unless it already IS a Firebase project. */
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
    // 409: addFirebase raced with an earlier run that had actually landed.
    if (!isGoogleApiStatus(error, 409)) throw error;
    await callGoogleApi(accessToken, getUrl);
  }
}

/** Creates the native Firestore `(default)` database unless it exists. */
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
    // 409 ALREADY_EXISTS: an earlier run got here first.
    if (!isGoogleApiStatus(error, 409)) throw error;
  }
}

interface WebAppSummary {
  name: string;
  displayName?: string;
}

/** Prefers OUR app by displayName but accepts any existing web app — after
 *  a partial failure there may already be exactly one lying around, and it
 *  must be reused rather than duplicated. */
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
 * Returns the SDK config of the FlowLedger web app, creating it ONLY if no
 * web app exists yet. The old createWebApp blindly created another app on
 * every retry; this version reuses whatever a previous partial run made.
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
    // 409: an earlier run created the app between our list and this create.
    if (!isGoogleApiStatus(error, 409)) throw error;
  }

  const app = await findExistingWebApp(accessToken, projectId, displayName);
  if (!app) throw new Error('Web app was not created');
  return fetchWebAppConfig(accessToken, app.name);
}

/** Enables Google Sign-In unless it is already enabled; the PATCH itself is
 *  idempotent, the GET just avoids a pointless write. */
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
    // Not configured yet (404) or Identity Toolkit still settling right
    // after being enabled — the PATCH below is the source of truth anyway.
    if (!isGoogleApiStatus(error, 404, 400, 403)) throw error;
  }

  await callGoogleApi(accessToken, configUrl, {
    method: 'PATCH',
    body: JSON.stringify({ enabled: true, idpId: 'google.com' }),
  });
}
