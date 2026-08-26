/**
 * Client bootstrap for the CONTROL-PLANE Firebase project (the vendor's
 * own project used only for sign-in + provisioning — see
 * shared/src/firebase/controlPlane.ts). Imported once, for its side
 * effect, from main.tsx before the router mounts.
 *
 * The customer's OWN Firebase project is NOT initialized here — that
 * happens dynamically in ConnectingScreen/JoinScreen via
 * initCustomerFirebase() once a firebaseConfig is known.
 */
import { initControlPlaneFirebase } from '@flowledger/shared';

const env = import.meta.env;

const requiredKeys = [
  'VITE_CONTROL_PLANE_FIREBASE_API_KEY',
  'VITE_CONTROL_PLANE_FIREBASE_AUTH_DOMAIN',
  'VITE_CONTROL_PLANE_FIREBASE_PROJECT_ID',
  'VITE_CONTROL_PLANE_FIREBASE_STORAGE_BUCKET',
  'VITE_CONTROL_PLANE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_CONTROL_PLANE_FIREBASE_APP_ID',
] as const;

const missing = requiredKeys.filter((key) => !env[key]);

if (missing.length > 0) {
  throw new Error(
    'Missing control-plane Firebase configuration. Copy client/.env.example to client/.env and fill in:\n' +
      missing.join('\n'),
  );
}

initControlPlaneFirebase({
  apiKey: env.VITE_CONTROL_PLANE_FIREBASE_API_KEY,
  authDomain: env.VITE_CONTROL_PLANE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_CONTROL_PLANE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_CONTROL_PLANE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_CONTROL_PLANE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_CONTROL_PLANE_FIREBASE_APP_ID,
});