import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from '../admin.js';
import {
  addFirebaseToProject,
  createFirestoreDatabase,
  createGoogleCloudProject,
  createWebApp,
  enableGoogleSignIn,
  enableServices,
} from './googleCloudClient.js';
import { deployFirestoreIndexes, deployFirestoreRules } from './deployRules.js';

interface CreateCustomerProjectPayload {
  /** OAuth access token with cloud-platform + firebase scopes, obtained
   *  client-side via a second, incremental Google consent. */
  accessToken: string;
  firestoreLocationId?: string;
}

function customerProjectId(uid: string): string {
  // Cloud project IDs: 6-30 chars, lowercase letters/digits/hyphens.
  return `flowledger-${uid.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16)}`;
}

/**
 * Orchestrates creating a brand-new, customer-owned Firebase project and
 * wiring it up to be ready for the FlowLedger app: Firestore Native
 * database, a registered Web App (for its SDK config), Google Sign-In
 * enabled, and the product's Security Rules/indexes deployed. Everything
 * runs against the CALLER's Google Cloud quota/billing, using their own
 * OAuth token — this function itself only reads/writes the control-plane's
 * `customers/{uid}` status document via the Admin SDK.
 *
 * Idempotent: if the customer already has a `ready` project, returns it
 * without re-provisioning.
 */
export const createCustomerProject = onCall<CreateCustomerProjectPayload>(
  { timeoutSeconds: 300 },
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
    const existing = await customerRef.get();
    if (existing.exists && existing.data()?.status === 'ready') {
      return existing.data();
    }

    const projectId = customerProjectId(uid);
    await customerRef.set(
      { status: 'provisioning', projectId, createdAt: new Date().toISOString() },
      { merge: true },
    );

    try {
      await createGoogleCloudProject(accessToken, projectId, 'FlowLedger');
      await enableServices(accessToken, projectId);
      await addFirebaseToProject(accessToken, projectId);
      await createFirestoreDatabase(accessToken, projectId, firestoreLocationId);
      const webAppConfig = await createWebApp(accessToken, projectId, 'FlowLedger Web');
      await enableGoogleSignIn(accessToken, projectId);
      await deployFirestoreRules(accessToken, projectId);
      await deployFirestoreIndexes(accessToken, projectId);

      const record = {
        status: 'ready' as const,
        projectId,
        firebaseConfig: webAppConfig,
        readyAt: new Date().toISOString(),
      };
      await customerRef.set(record, { merge: true });
      return record;
    } catch (error) {
      await customerRef.set(
        { status: 'failed', error: error instanceof Error ? error.message : String(error) },
        { merge: true },
      );
      throw new HttpsError('internal', 'Provisioning failed', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  },
);
