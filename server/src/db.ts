import { MongoClient, type Db } from 'mongodb';
import {
  categoriesCollection,
  counterpartiesCollection,
  currenciesCollection,
  debtsCollection,
  holdersCollection,
  invitesCollection,
  membersCollection,
  sessionsCollection,
  transactionsCollection,
  usersCollection,
  walletsCollection,
} from './collections.js';

export interface Database {
  client: MongoClient;
  db: Db;
}

/** Подключение к MongoDB. Ожидается replica set — без него не работают
 *  транзакции, на которых держится пересчёт балансов кошельков и долгов. */
export async function connectDatabase(uri: string, dbName: string): Promise<Database> {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  await ensureIndexes(db);
  return { client, db };
}

/** Индексы коллекций. createIndexes идемпотентен — безопасно вызывать при
 *  каждом старте. Пополняется по мере переноса сущностей из Firestore. */
export async function ensureIndexes(db: Db): Promise<void> {
  await usersCollection(db).createIndex({ googleSub: 1 }, { unique: true });
  await sessionsCollection(db).createIndexes([
    { key: { tokenHash: 1 }, unique: true },
    { key: { userId: 1 } },
    // TTL: MongoDB сам удаляет сессии после expiresAt.
    { key: { expiresAt: 1 }, expireAfterSeconds: 0 },
  ]);
  // Все сущности базы выбираются по userId (id владельца базы).
  for (const collection of [
    walletsCollection(db),
    categoriesCollection(db),
    currenciesCollection(db),
    holdersCollection(db),
    counterpartiesCollection(db),
    debtsCollection(db),
  ]) {
    await collection.createIndex({ userId: 1 });
  }
  await transactionsCollection(db).createIndexes([
    { key: { userId: 1, date: -1, createdAt: -1 } },
    { key: { userId: 1, walletId: 1, date: -1 } },
    { key: { userId: 1, transferToWalletId: 1, date: -1 } },
    { key: { userId: 1, debtId: 1 } },
  ]);
  await membersCollection(db).createIndexes([
    { key: { ownerId: 1, userId: 1 }, unique: true },
    { key: { userId: 1 } },
  ]);
  await invitesCollection(db).createIndex({ ownerId: 1, status: 1 });
}
