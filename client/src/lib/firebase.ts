/**
 * Бутстрап единого Firebase-проекта продукта — импортируется один раз ради
 * побочного эффекта из main.tsx до монтирования роутера.
 */
import { initFirebase } from '@flowledger/shared';

const env = import.meta.env;

const requiredKeys = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

const missing = requiredKeys.filter((key) => !env[key]);

if (missing.length > 0) {
  throw new Error(
    'Missing Firebase configuration. Copy client/.env.example to client/.env and fill in:\n' +
      missing.join('\n'),
  );
}

initFirebase({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});
