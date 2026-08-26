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
  /** OAuth access token with cloud-platform + firebase scopes, obtained
   *  client-side via a second, incremental Google consent. */
  accessToken: string;
  firestoreLocationId?: string;
}

/** Mirrors @flowledger/interfaces ProvisioningSteps — the functions package
 *  deliberately has no dependency on the interfaces workspace. */
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
  // Cloud project IDs: 6-30 chars, lowercase letters/digits/hyphens.
  return `flowledger-${uid.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16)}`;
}

/** A 'provisioning' record whose heartbeat (updatedAt) is younger than this
 *  means another invocation is probably still executing — a duplicate call
 *  must NOT start a second pipeline over it. Stale heartbeat → the previous
 *  run died mid-way and this call resumes from the recorded checkpoints. */
const PROVISIONING_HEARTBEAT_TTL_MS = 10 * 60 * 1000;

/**
 * Orchestrates creating a brand-new, customer-owned Firebase project and
 * wiring it up to be ready for the FlowLedger app: Firestore Native
 * database, a registered Web App (for its SDK config), Google Sign-In
 * enabled, and the product's Security Rules/indexes deployed. Everything
 * runs against the CALLER's Google Cloud quota/billing, using their own
 * OAuth token — this function itself only reads/writes the control-plane's
 * `customers/{uid}` status document via the Admin SDK.
 *
 * Fully re-runnable after a partial failure:
 * - every remote step is verify-then-act idempotent (googleCloudClient.ts);
 * - each completed step is checkpointed into `customers/{uid}.steps`, so a
 *   retry skips straight past what already landed remotely;
 * - a fresh 'provisioning' heartbeat makes concurrent duplicate calls wait
 *   instead of double-provisioning; a stale one lets the next call resume.
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

    // Fully provisioned earlier — hand back the stored config untouched.
    if (existing?.status === 'ready') {
      return existing;
    }

    if (existing?.status === 'provisioning') {
      const updatedAtMs = Date.parse(existing.updatedAt ?? '');
      const heartbeatFresh =
        Number.isFinite(updatedAtMs) && Date.now() - updatedAtMs < PROVISIONING_HEARTBEAT_TTL_MS;
      if (heartbeatFresh) {
        // Concurrent duplicate call: report current state; the UI follows
        // progress through its own onSnapshot listener on customers/{uid}.
        return existing;
      }
      // Stale heartbeat — previous run died mid-way; fall through and resume.
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

    /** Durable checkpoint for one pipeline step, plus any extra record
     *  fields that step produced (e.g. firebaseConfig). */
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

      // Persist firebaseConfig AS SOON AS the web app exists — later steps
      // may still fail, but the config must never be lost or re-created.
      let webAppConfig = existing?.firebaseConfig;
      if (!steps.webAppCreated || !webAppConfig) {
        webAppConfig = await ensureWebApp(accessToken, projectId, 'FlowLedger Web');
        await completeStep('webAppCreated', { firebaseConfig: webAppConfig });
      }

      if (!steps.signInEnabled) {
        await ensureGoogleSignInEnabled(accessToken, projectId);
        await completeStep('signInEnabled');
      }
      // Rules deploy is naturally idempotent (release → newest ruleset), but
      // skipping it when checkpointed avoids pointless API churn on resume.
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
