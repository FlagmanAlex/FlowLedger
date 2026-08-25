import { type FirebaseApp, type FirebaseOptions, getApps, initializeApp } from 'firebase/app';
import { type Firestore, getFirestore } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';
import { type Functions, getFunctions } from 'firebase/functions';

const CONTROL_PLANE_APP_NAME = 'control-plane';

let app: FirebaseApp | undefined;

/**
 * The control-plane is the vendor's own Firebase project — it exists only
 * to identify who's signing up and to run the createCustomerProject Cloud
 * Function that provisions each customer's OWN, isolated Firebase project.
 * No product data (wallets/transactions/...) ever lives here.
 */
export function initControlPlaneFirebase(config: FirebaseOptions): {
  app: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
} {
  const existing = getApps().find((a) => a.name === CONTROL_PLANE_APP_NAME);
  app = existing ?? initializeApp(config, CONTROL_PLANE_APP_NAME);
  return { app, firestore: getFirestore(app), auth: getAuth(app) };
}

export function getControlPlaneAuth(): Auth {
  if (!app) throw new Error('Control-plane Firebase not initialized. Call initControlPlaneFirebase() first.');
  return getAuth(app);
}

export function getControlPlaneFirestore(): Firestore {
  if (!app) throw new Error('Control-plane Firebase not initialized. Call initControlPlaneFirebase() first.');
  return getFirestore(app);
}

export function getControlPlaneFunctions(): Functions {
  if (!app) throw new Error('Control-plane Firebase not initialized. Call initControlPlaneFirebase() first.');
  return getFunctions(app);
}
