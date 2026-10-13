import type { Collection, Db } from 'mongodb';
import type {
  Category,
  Counterparty,
  Currency,
  Debt,
  Holder,
  Invite,
  Member,
  Transaction,
  UserPlan,
  Wallet,
} from '@flowledger/interfaces';

/** Документ Mongo для сущности из interfaces: `id` хранится как `_id`
 *  (строка — перенесённый Firestore-id или hex ObjectId). */
export type Doc<T extends { id: string }> = Omit<T, 'id'> & { _id: string };

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

export type WalletDoc = Doc<Wallet>;
export type CategoryDoc = Doc<Category>;
export type CurrencyDoc = Doc<Currency>;
export type HolderDoc = Doc<Holder>;
export type CounterpartyDoc = Doc<Counterparty>;
export type TransactionDoc = Doc<Transaction>;
export type DebtDoc = Doc<Debt>;
export type InviteDoc = Doc<Invite>;

/** Участник чужой базы. В Firestore — подколлекция `users/{ownerId}/members/{uid}`,
 *  здесь плоская коллекция; `_id` = `${ownerId}:${userId}`. */
export interface MemberDoc extends Omit<Member, 'uid'> {
  _id: string;
  ownerId: string;
  userId: string;
}

export const memberId = (ownerId: string, userId: string) => `${ownerId}:${userId}`;

export const walletsCollection = (db: Db) => db.collection<WalletDoc>('wallets');
export const categoriesCollection = (db: Db) => db.collection<CategoryDoc>('categories');
export const currenciesCollection = (db: Db) => db.collection<CurrencyDoc>('currencies');
export const holdersCollection = (db: Db) => db.collection<HolderDoc>('holders');
export const counterpartiesCollection = (db: Db) => db.collection<CounterpartyDoc>('counterparties');
export const transactionsCollection = (db: Db) => db.collection<TransactionDoc>('transactions');
export const debtsCollection = (db: Db) => db.collection<DebtDoc>('debts');
export const invitesCollection = (db: Db) => db.collection<InviteDoc>('invites');
export const membersCollection = (db: Db) => db.collection<MemberDoc>('members');
