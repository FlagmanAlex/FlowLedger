import { MongoClient, type Db } from 'mongodb';

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
export async function ensureIndexes(_db: Db): Promise<void> {}
