/**
 * Загрузка выгрузки Firestore (scripts/firestore-export.mjs) в MongoDB —
 * вторая половина переноса данных. Собирается в dist/import-firestore.js и
 * запускается на VPS рядом с сервером (секреты Mongo не покидают сервер):
 *
 *   node --env-file=<env> import-firestore.js <export.json>           — проверка (dry-run)
 *   node --env-file=<env> import-firestore.js <export.json> --apply   — загрузка
 *
 * --apply полностью заменяет данные баз (кошельки, операции и т.д.) содержимым
 * выгрузки — до cutover в Mongo только тестовые данные. Пользователи
 * переносятся с прежними id (Firebase uid), чтобы все userId/createdBy/ownerId
 * в данных остались валидными; тестовые пользователи, созданные входом в
 * новый сервер до переноса (тот же Google-аккаунт, другой _id), заменяются
 * перенесёнными, их сессии удаляются — нужно войти заново.
 */
import { readFile } from 'node:fs/promises';
import { MongoClient, type Db } from 'mongodb';
import type { Transaction } from '@flowledger/interfaces';
import { sessionsCollection, usersCollection, type UserDoc } from '../collections.js';
import { ensureIndexes } from '../db.js';
import { debtDeltas, walletDeltas } from '../ledger.js';

type FirestoreDoc = { id: string } & Record<string, unknown>;

interface ExportFile {
  exportedAt: string;
  authUsers: Array<{
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    googleSub: string | null;
    createdAt: string | null;
  }>;
  collections: Record<string, FirestoreDoc[]>;
  members: Array<{ ownerId: string; uid: string } & Record<string, unknown>>;
}

/** Коллекции данных баз — переносятся один в один (id → _id). */
const DATA_COLLECTIONS = [
  'wallets',
  'categories',
  'currencies',
  'holders',
  'transactions',
  'recurringTemplates',
  'debts',
  'counterparties',
  'invites',
] as const;

const round = (value: number) => Math.round(value * 100) / 100;

function toDoc({ id, ...rest }: FirestoreDoc) {
  return { _id: id, ...rest };
}

/** Пользователи для Mongo: профиль из Firestore users/{uid} + Google sub из
 *  Firebase Auth. Без Google-входа пользователя не перенести (войти он
 *  сможет только через Google). */
function buildUsers(data: ExportFile, warnings: string[]): UserDoc[] {
  const profiles = new Map((data.collections.users ?? []).map((doc) => [doc.id, doc]));
  const users: UserDoc[] = [];
  for (const auth of data.authUsers) {
    if (!auth.googleSub) {
      warnings.push(`Пользователь ${auth.uid}: нет входа через Google — не перенесён`);
      continue;
    }
    const profile = profiles.get(auth.uid);
    users.push({
      _id: auth.uid,
      googleSub: auth.googleSub,
      email: (profile?.email as string) || auth.email || '',
      displayName: (profile?.displayName as string) || auth.displayName || auth.email || '',
      ...((profile?.photoURL as string) || auth.photoURL
        ? { photoURL: (profile?.photoURL as string) || auth.photoURL! }
        : {}),
      plan: profile?.plan === 'premium' ? 'premium' : 'free',
      createdAt: (profile?.createdAt as string) || auth.createdAt || new Date().toISOString(),
      ...(profile?.activeOwnerId ? { activeOwnerId: profile.activeOwnerId as string } : {}),
    });
  }
  for (const uid of profiles.keys()) {
    if (!data.authUsers.some((auth) => auth.uid === uid)) {
      warnings.push(`Профиль users/${uid} без учётной записи Firebase Auth — не перенесён`);
    }
  }
  return users;
}

/** Сверка денормализованных полей с пересчётом из операций — как в
 *  Firestore-версии (balance кошелька = сумма дельт его операций, остаток
 *  долга — сумма дельт его операций). Расхождения — предупреждение, не
 *  ошибка: переносятся сохранённые значения. */
function checkBalances(data: ExportFile, warnings: string[]) {
  const transactions = (data.collections.transactions ?? []) as unknown as Transaction[];
  const walletSums = new Map<string, number>();
  const debtSums = new Map<string, number>();
  for (const t of transactions) {
    for (const [id, delta] of walletDeltas(t, 1)) walletSums.set(id, (walletSums.get(id) ?? 0) + delta);
    for (const [id, delta] of debtDeltas(t, 1)) debtSums.set(id, (debtSums.get(id) ?? 0) + delta);
  }
  let walletMismatches = 0;
  for (const wallet of data.collections.wallets ?? []) {
    const stored = round(Number(wallet.balance ?? 0));
    const computed = round(walletSums.get(wallet.id) ?? 0);
    if (stored !== computed) {
      walletMismatches++;
      warnings.push(`Кошелёк ${wallet.id}: баланс ${stored}, по операциям ${computed}`);
    }
  }
  let debtMismatches = 0;
  for (const debt of data.collections.debts ?? []) {
    const stored = round(Number(debt.remainingAmount ?? 0));
    const computed = round(Math.max(0, debtSums.get(debt.id) ?? 0));
    if (stored !== computed) {
      debtMismatches++;
      warnings.push(`Долг ${debt.id}: остаток ${stored}, по операциям ${computed}`);
    }
  }
  console.log(
    `Сверка: кошельков с расхождением баланса — ${walletMismatches}, долгов с расхождением остатка — ${debtMismatches}`,
  );
}

async function apply(db: Db, data: ExportFile, users: UserDoc[]) {
  // Тестовые пользователи с тем же Google-аккаунтом, но другим _id.
  const subs = users.map((user) => user.googleSub);
  const stale = await usersCollection(db)
    .find({ googleSub: { $in: subs }, _id: { $nin: users.map((user) => user._id) } })
    .toArray();
  if (stale.length > 0) {
    const staleIds = stale.map((user) => user._id);
    await sessionsCollection(db).deleteMany({ userId: { $in: staleIds } });
    await usersCollection(db).deleteMany({ _id: { $in: staleIds } });
    console.log(`Заменено тестовых пользователей: ${stale.length} (их сессии удалены)`);
  }
  for (const user of users) {
    await usersCollection(db).replaceOne({ _id: user._id }, user, { upsert: true });
  }

  for (const name of DATA_COLLECTIONS) {
    const collection = db.collection<{ _id: string }>(name);
    await collection.deleteMany({});
    const docs = (data.collections[name] ?? []).map(toDoc);
    if (docs.length > 0) await collection.insertMany(docs);
  }

  const members = db.collection<{ _id: string }>('members');
  await members.deleteMany({});
  const memberDocs = data.members.map(({ ownerId, uid, ...rest }) => ({
    ...rest,
    _id: `${ownerId}:${uid}`,
    ownerId,
    userId: uid,
  }));
  if (memberDocs.length > 0) await members.insertMany(memberDocs);

  await ensureIndexes(db);

  // Контроль: в Mongo ровно столько документов, сколько в выгрузке.
  let ok = true;
  for (const name of [...DATA_COLLECTIONS, 'members'] as const) {
    const expected = name === 'members' ? memberDocs.length : (data.collections[name] ?? []).length;
    const actual = await db.collection(name).countDocuments();
    if (actual !== expected) {
      ok = false;
      console.error(`ОШИБКА ${name}: в выгрузке ${expected}, в Mongo ${actual}`);
    }
  }
  for (const user of users) {
    if (!(await usersCollection(db).findOne({ _id: user._id }))) {
      ok = false;
      console.error(`ОШИБКА: пользователь ${user._id} не записан`);
    }
  }
  if (!ok) throw new Error('Контроль после загрузки не прошёл');
  console.log('Загрузка завершена, контроль количества документов пройден');
}

async function main() {
  const [file, flag] = process.argv.slice(2);
  if (!file) {
    console.error('Usage: node import-firestore.js <export.json> [--apply]');
    process.exit(1);
  }
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) throw new Error('MONGO_URI не задан (запускайте с --env-file)');
  const applyMode = flag === '--apply';

  const data = JSON.parse(await readFile(file, 'utf8')) as ExportFile;
  console.log(`Выгрузка от ${data.exportedAt}`);
  for (const name of DATA_COLLECTIONS) {
    console.log(`  ${name}: ${(data.collections[name] ?? []).length}`);
  }
  console.log(`  members: ${data.members.length}`);
  console.log(`  пользователей (Auth): ${data.authUsers.length}`);

  const warnings: string[] = [];
  const users = buildUsers(data, warnings);
  console.log(`Пользователей к переносу: ${users.length}`);
  checkBalances(data, warnings);
  for (const warning of warnings) console.warn(`  ! ${warning}`);

  if (!applyMode) {
    console.log('Режим проверки (dry-run): в Mongo ничего не записано. Для загрузки — --apply.');
    return;
  }

  const client = new MongoClient(mongoUri);
  await client.connect();
  try {
    await apply(client.db(process.env.MONGO_DB || 'flowledger'), data, users);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
