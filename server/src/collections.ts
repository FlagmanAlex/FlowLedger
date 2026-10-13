import type { Collection, Db } from 'mongodb';
import type { UserPlan } from '@flowledger/interfaces';

/** Документ коллекции `users`. `_id` — строка: при переносе из Firestore
 *  сохраняется Firebase uid, новым пользователям — hex ObjectId. */
export interface UserDoc {
  _id: string;
  /** `sub` аккаунта Google — по нему находим пользователя при входе. */
  googleSub: string;
  email: string;
  displayName: string;
  photoURL?: string;
  plan: UserPlan;
  createdAt: string;
  activeOwnerId?: string;
}

/** Документ коллекции `sessions` — одна сессия входа (устройство/браузер). */
export interface SessionDoc {
  _id: string;
  userId: string;
  /** sha256 текущего refresh-токена; сам токен не хранится. */
  tokenHash: string;
  createdAt: Date;
  /** Date, а не ISO-строка, — по нему TTL-индекс удаляет протухшие сессии. */
  expiresAt: Date;
  userAgent?: string;
}

export function usersCollection(db: Db): Collection<UserDoc> {
  return db.collection<UserDoc>('users');
}

export function sessionsCollection(db: Db): Collection<SessionDoc> {
  return db.collection<SessionDoc>('sessions');
}
