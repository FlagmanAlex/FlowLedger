/**
 * Mobile bootstrap for the CONTROL-PLANE Firebase project (the vendor's
 * own project used only for sign-in + provisioning — see
 * shared/src/firebase/controlPlane.ts). Imported once, for its side
 * effect, from App.tsx before navigation mounts.
 *
 * Config comes from app.json → expo.extra.controlPlaneFirebase* (fill
 * these in locally or via EAS secrets; see README's EAS section). The
 * customer's OWN Firebase project is NOT initialized here — that happens
 * dynamically via initCustomerFirebase() once a firebaseConfig is known
 * (ConnectScreen / future native provisioning flow).
 */
import Constants from 'expo-constants';
import { initControlPlaneFirebase } from '@flowledger/shared';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;

const requiredKeys = [
  'controlPlaneFirebaseApiKey',
  'controlPlaneFirebaseAuthDomain',
  'controlPlaneFirebaseProjectId',
  'controlPlaneFirebaseStorageBucket',
  'controlPlaneFirebaseMessagingSenderId',
  'controlPlaneFirebaseAppId',
] as const;

const missing = requiredKeys.filter((key) => !extra[key]);

if (missing.length > 0) {
  throw new Error(
    'Missing control-plane Firebase configuration. Fill in app.json → expo.extra:\n' +
      missing.join('\n'),
  );
}

initControlPlaneFirebase({
  apiKey: extra.controlPlaneFirebaseApiKey!,
  authDomain: extra.controlPlaneFirebaseAuthDomain!,
  projectId: extra.controlPlaneFirebaseProjectId!,
  storageBucket: extra.controlPlaneFirebaseStorageBucket!,
  messagingSenderId: extra.controlPlaneFirebaseMessagingSenderId!,
  appId: extra.controlPlaneFirebaseAppId!,
});