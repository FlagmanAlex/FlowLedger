/**
 * Бутстрап CONTROL-PLANE Firebase-проекта для мобильного клиента (вендорский
 * проект, использующийся только для входа и провижининга — см.
 * shared/src/firebase/controlPlane.ts). Импортируется один раз ради
 * побочного эффекта из App.tsx до монтирования навигации.
 *
 * Конфиг берётся из app.json → expo.extra.controlPlaneFirebase* (заполнить
 * локально или через секреты EAS; см. раздел EAS в README). СОБСТВЕННЫЙ
 * Firebase-проект покупателя здесь НЕ инициализируется — это происходит
 * динамически через initCustomerFirebase(), когда известен firebaseConfig
 * (ConnectScreen / будущий нативный флоу провижининга).
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