import {
  GoogleAuthProvider,
  getRedirectResult,
  onIdTokenChanged,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import type { AuthUser } from '@flowledger/interfaces';
import { getFirebaseAuth } from './firebase.js';
import { ensureUserDoc } from '../repositories/users.repo.js';

function toAuthUser(user: FirebaseUser): AuthUser {
  return {
    uid: user.uid,
    email: user.email ?? '',
    displayName: user.displayName ?? '',
    photoURL: user.photoURL ?? undefined,
  };
}

/** Web: вход через всплывающее окно Google (доступно только в браузере).
 *  Ненадёжен на мобильных браузерах (COOP/сторонние cookie/попап
 *  блокируется в in-app webview) — там даёт network-request-failed вместо
 *  реальной сетевой ошибки, см. signInWithGoogleRedirect. */
export async function signInWithGooglePopup(): Promise<FirebaseUser> {
  const result = await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
  await ensureUserDoc(toAuthUser(result.user));
  return result.user;
}

/** Web-мобильный: вход через редирект на страницу Google вместо попапа —
 *  попапы на мобильных браузерах (особенно во встроенных webview вроде
 *  Telegram/других приложений) часто блокируются или рвутся на середине,
 *  и Firebase Auth в этом случае отдаёт auth/network-request-failed вместо
 *  явной ошибки. Возврата из этой функции нет — страница перезагружается
 *  на Google и обратно; результат забирает completeGoogleRedirectSignIn. */
export async function signInWithGoogleRedirect(): Promise<void> {
  await signInWithRedirect(getFirebaseAuth(), new GoogleAuthProvider());
}

/** Вызывать один раз при старте приложения — забирает результат
 *  signInWithGoogleRedirect после возврата со страницы Google. Возвращает
 *  null, если редиректа не было (обычный старт без ожидающего входа). */
export async function completeGoogleRedirectSignIn(): Promise<FirebaseUser | null> {
  const result = await getRedirectResult(getFirebaseAuth());
  if (!result) return null;
  await ensureUserDoc(toAuthUser(result.user));
  return result.user;
}

/** Mobile: обмен Google ID-токена (см. expo-auth-session в mobile/src/screens/LoginScreen.tsx)
 *  на сессию Firebase Auth — signInWithPopup недоступен вне браузера. */
export async function signInWithGoogleIdToken(idToken: string): Promise<FirebaseUser> {
  const credential = GoogleAuthProvider.credential(idToken);
  const result = await signInWithCredential(getFirebaseAuth(), credential);
  await ensureUserDoc(toAuthUser(result.user));
  return result.user;
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(getFirebaseAuth());
}

export function subscribeToAuthUser(callback: (user: AuthUser | null) => void): () => void {
  return onIdTokenChanged(getFirebaseAuth(), (firebaseUser) => {
    callback(firebaseUser ? toAuthUser(firebaseUser) : null);
  });
}
