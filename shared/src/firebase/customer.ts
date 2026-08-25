import {
  type FirebaseApp,
  type FirebaseOptions,
  deleteApp,
  getApps,
  initializeApp,
} from 'firebase/app';
import {
  type Firestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';

const CUSTOMER_APP_NAME = 'customer';

let app: FirebaseApp | undefined;
let firestore: Firestore | undefined;
let auth: Auth | undefined;

/**
 * Connects to a customer-owned Firebase project (their own bought/created
 * backend — see control-plane's createCustomerProject). Re-callable: a
 * user can switch between their own workspace and one they were invited
 * into, each with a different config, so any previously connected
 * "customer" app instance is torn down first.
 *
 * Enables Firestore's persistent local cache so writes made offline (e.g.
 * on mobile with no signal) queue locally and sync automatically once
 * connectivity returns.
 */
export async function initCustomerFirebase(config: FirebaseOptions): Promise<{
  app: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
}> {
  const existing = getApps().find((a) => a.name === CUSTOMER_APP_NAME);
  if (existing) {
    await deleteApp(existing);
  }

  app = initializeApp(config, CUSTOMER_APP_NAME);
  firestore = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  auth = getAuth(app);

  return { app, firestore, auth };
}

export function getCustomerFirestore(): Firestore {
  if (!firestore) throw new Error('No customer Firebase project connected. Call initCustomerFirebase() first.');
  return firestore;
}

export function getCustomerAuth(): Auth {
  if (!auth) throw new Error('No customer Firebase project connected. Call initCustomerFirebase() first.');
  return auth;
}
