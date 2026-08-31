import { type FirebaseApp, type FirebaseOptions, getApps, initializeApp } from 'firebase/app';
import { type Firestore, initializeFirestore, persistentLocalCache } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';

let app: FirebaseApp | undefined;
let firestore: Firestore | undefined;
let auth: Auth | undefined;

/**
 * Единый Firebase-проект продукта (один на всех пользователей, изоляция
 * данных — через поле userId + Security Rules, см. firestore.rules в корне
 * репозитория). Вызывается один раз при старте приложения —
 * client/src/lib/firebase.ts и mobile/src/lib/firebase.ts.
 *
 * persistentLocalCache включает офлайн-кеш Firestore — работает и в
 * браузере (IndexedDB), и в React Native (см. shared/CLAUDE.md); без
 * явного tabManager используется однотабличный режим — безопасный
 * универсальный вариант для обеих платформ.
 */
export function initFirebase(config: FirebaseOptions): {
  app: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
} {
  app = getApps()[0] ?? initializeApp(config);
  firestore = initializeFirestore(app, { localCache: persistentLocalCache() });
  auth = getAuth(app);
  return { app, firestore, auth };
}

export function getFirestoreInstance(): Firestore {
  if (!firestore) throw new Error('Firebase not initialized. Call initFirebase() first.');
  return firestore;
}

export function getFirebaseAuth(): Auth {
  if (!auth) throw new Error('Firebase not initialized. Call initFirebase() first.');
  return auth;
}
