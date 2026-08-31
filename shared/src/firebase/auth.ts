import {
  GoogleAuthProvider,
  onIdTokenChanged,
  signInWithCredential,
  signInWithPopup,
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

/** Web: вход через всплывающее окно Google (доступно только в браузере). */
export async function signInWithGooglePopup(): Promise<FirebaseUser> {
  const result = await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
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
