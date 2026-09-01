import { deleteField, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import type { AuthUser, User } from '@flowledger/interfaces';
import { getFirestoreInstance } from '../firebase/firebase.js';

export function userDoc(uid: string) {
  return doc(getFirestoreInstance(), 'users', uid);
}

export async function getUser(uid: string): Promise<User | null> {
  const snap = await getDoc(userDoc(uid));
  return snap.exists() ? (snap.data() as User) : null;
}

/** Создаёт users/{uid} при первом входе (план по умолчанию — free);
 *  при повторных входах ничего не перезаписывает. */
export async function ensureUserDoc(authUser: AuthUser): Promise<void> {
  const ref = userDoc(authUser.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;

  const user: User = {
    uid: authUser.uid,
    email: authUser.email,
    displayName: authUser.displayName,
    photoURL: authUser.photoURL,
    plan: 'free',
    createdAt: new Date().toISOString(),
  };
  await setDoc(ref, user);
}

/** Переключает пользователя на базу другого владельца (принятие
 *  приглашения) или обратно на свою (`ownerId === undefined` — выход из
 *  общего доступа). Собственный документ, отдельного разрешения в
 *  `firestore.rules` не требует. */
export async function setActiveOwner(uid: string, ownerId: string | undefined): Promise<void> {
  await updateDoc(userDoc(uid), { activeOwnerId: ownerId ?? deleteField() });
}
