import { type FirebaseApp, type FirebaseOptions, getApps, initializeApp } from 'firebase/app';
import {
  type Firestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';

let app: FirebaseApp;
let firestore: Firestore;
let auth: Auth;

/**
 * Must run once before any other shared/* call. Enables Firestore's
 * persistent local cache so writes made offline (e.g. on mobile with no
 * signal) queue locally and sync automatically once connectivity returns.
 */
export function initFirebase(config: FirebaseOptions): {
  app: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
} {
  if (getApps().length === 0) {
    app = initializeApp(config);
    firestore = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
    auth = getAuth(app);
  }
  return { app, firestore, auth };
}

export function getFirebaseFirestore(): Firestore {
  if (!firestore) {
    throw new Error('Firebase not initialized. Call initFirebase() first.');
  }
  return firestore;
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    throw new Error('Firebase not initialized. Call initFirebase() first.');
  }
  return auth;
}
