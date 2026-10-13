import type { Db } from 'mongodb';
import { membersCollection } from './collections.js';
import { forbidden } from './http.js';

/** Есть ли у пользователя доступ к базе владельца ownerId: сам владелец или
 *  участник по принятому приглашению. Прямой перенос hasAccess() из
 *  firestore.rules. */
export async function hasAccess(db: Db, userId: string, ownerId: string): Promise<boolean> {
  if (userId === ownerId) return true;
  const member = await membersCollection(db).findOne({ ownerId, userId }, { projection: { _id: 1 } });
  return member !== null;
}

export async function assertAccess(db: Db, userId: string, ownerId: string): Promise<void> {
  if (!(await hasAccess(db, userId, ownerId))) {
    throw forbidden();
  }
}
