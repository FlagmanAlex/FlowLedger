/**
 * Thin wrappers over the Google Cloud / Firebase REST APIs used to
 * provision a brand-new, customer-owned Firebase project. Every call is
 * made with the CUSTOMER's own OAuth access token (elevated scopes:
 * cloud-platform + firebase) — the resulting project is theirs, on their
 * billing, not ours.
 */
import { callGoogleApi } from './googleApiClient.js';

export interface WebAppConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

async function pollOperation(accessToken: string, operationUrl: string): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const op = await callGoogleApi<{ done?: boolean; error?: { message: string } }>(
      accessToken,
      operationUrl,
    );
    if (op.done) {
      if (op.error) throw new Error(`Operation failed: ${op.error.message}`);
      return;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Timed out waiting for operation ${operationUrl}`);
}

export async function createGoogleCloudProject(
  accessToken: string,
  projectId: string,
  displayName: string,
): Promise<void> {
  const op = await callGoogleApi<{ name: string }>(
    accessToken,
    'https://cloudresourcemanager.googleapis.com/v3/projects',
    { method: 'POST', body: JSON.stringify({ projectId, displayName }) },
  );
  await pollOperation(accessToken, `https://cloudresourcemanager.googleapis.com/v3/${op.name}`);
}

export async function enableServices(accessToken: string, projectId: string): Promise<void> {
  const services = [
    'firestore.googleapis.com',
    'identitytoolkit.googleapis.com',
    'firebaserules.googleapis.com',
  ];
  await callGoogleApi(
    accessToken,
    `https://serviceusage.googleapis.com/v1/projects/${projectId}/services:batchEnable`,
    { method: 'POST', body: JSON.stringify({ serviceIds: services }) },
  );
}

export async function addFirebaseToProject(accessToken: string, projectId: string): Promise<void> {
  const op = await callGoogleApi<{ name: string }>(
    accessToken,
    `https://firebase.googleapis.com/v1beta1/projects/${projectId}:addFirebase`,
    { method: 'POST' },
  );
  await pollOperation(accessToken, `https://firebase.googleapis.com/v1beta1/${op.name}`);
}

export async function createFirestoreDatabase(
  accessToken: string,
  projectId: string,
  locationId: string,
): Promise<void> {
  await callGoogleApi(
    accessToken,
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases?databaseId=(default)`,
    {
      method: 'POST',
      body: JSON.stringify({ type: 'FIRESTORE_NATIVE', locationId }),
    },
  );
}

export async function createWebApp(
  accessToken: string,
  projectId: string,
  displayName: string,
): Promise<WebAppConfig> {
  const op = await callGoogleApi<{ name: string; response?: { name: string } }>(
    accessToken,
    `https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps`,
    { method: 'POST', body: JSON.stringify({ displayName }) },
  );
  await pollOperation(accessToken, `https://firebase.googleapis.com/v1beta1/${op.name}`);

  const apps = await callGoogleApi<{ apps: { name: string }[] }>(
    accessToken,
    `https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps`,
  );
  const appName = apps.apps[0]?.name;
  if (!appName) throw new Error('Web app was not created');

  return callGoogleApi<WebAppConfig>(
    accessToken,
    `https://firebase.googleapis.com/v1beta1/${appName}/config`,
  );
}

export async function enableGoogleSignIn(accessToken: string, projectId: string): Promise<void> {
  await callGoogleApi(
    accessToken,
    `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/defaultSupportedIdpConfigs/google.com?updateMask=enabled`,
    { method: 'PATCH', body: JSON.stringify({ enabled: true, idpId: 'google.com' }) },
  );
}
