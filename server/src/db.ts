import { MongoClient, type Db } from 'mongodb';
import { sessionsCollection, usersCollection } from './collections.js';

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
}
