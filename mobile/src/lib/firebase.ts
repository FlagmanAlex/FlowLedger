/**
 * Бутстрап единого Firebase-проекта продукта — импортируется один раз ради
 * побочного эффекта из App.tsx до монтирования навигации. Конфиг берётся из
 * app.json → expo.extra.firebase* (заполнить локально или через секреты EAS).
 */
import Constants from 'expo-constants';
import { initFirebase } from '@flowledger/shared';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;

const requiredKeys = [
  'firebaseApiKey',
  'firebaseAuthDomain',
  'firebaseProjectId',
  'firebaseStorageBucket',
  'firebaseMessagingSenderId',
  'firebaseAppId',
] as const;

const missing = requiredKeys.filter((key) => !extra[key]);

if (missing.length > 0) {
  throw new Error(
    'Missing Firebase configuration. Fill in app.json → expo.extra:\n' + missing.join('\n'),
  );
}

initFirebase({
  apiKey: extra.firebaseApiKey!,
  authDomain: extra.firebaseAuthDomain!,
  projectId: extra.firebaseProjectId!,
  storageBucket: extra.firebaseStorageBucket!,
  messagingSenderId: extra.firebaseMessagingSenderId!,
  appId: extra.firebaseAppId!,
});
