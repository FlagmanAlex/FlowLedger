// Выгрузка всех данных FlowLedger из Firestore и Firebase Auth в один JSON —
// первая половина переноса данных в MongoDB (вторая — src/migrate/import.ts на
// VPS). Запускается в GitHub Actions (.github/workflows/migrate-firestore.yml)
// от сервис-аккаунта из секрета FIREBASE_SERVICE_ACCOUNT; ему нужны роли
// Cloud Datastore Viewer и Firebase Authentication Viewer.
//
// Использование: GOOGLE_APPLICATION_CREDENTIALS=key.json node firestore-export.mjs out.json
// firebase-admin ставится отдельно (npm i --no-save firebase-admin) — в
// зависимости server он не нужен.
import { writeFile } from 'node:fs/promises';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { Timestamp, getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = 'flowledger2';
const COLLECTIONS = [
  'users',
  'wallets',
  'categories',
  'currencies',
  'holders',
  'transactions',
  'recurringTemplates',
  'debts',
  'counterparties',
  'invites',
];

const outFile = process.argv[2];
if (!outFile) {
  console.error('Usage: node firestore-export.mjs <out.json>');
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
const firestore = getFirestore();

/** Timestamp Firestore → ISO-строка (в данных FlowLedger даты — строки и
 *  числа, но на всякий случай). */
function plain(value) {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
  }
  return value;
}

const collections = {};
for (const name of COLLECTIONS) {
  const snap = await firestore.collection(name).get();
  collections[name] = snap.docs.map((doc) => ({ id: doc.id, ...plain(doc.data()) }));
  console.log(`${name}: ${snap.size}`);
}

// Подколлекции users/{ownerId}/members/{uid}.
const membersSnap = await firestore.collectionGroup('members').get();
const members = membersSnap.docs
  .filter((doc) => doc.ref.parent.parent?.parent.id === 'users')
  .map((doc) => ({ ownerId: doc.ref.parent.parent.id, uid: doc.id, ...plain(doc.data()) }));
console.log(`members: ${members.length}`);

// Firebase Auth: uid → Google sub (providerData google.com).
const authUsers = [];
let pageToken;
do {
  const page = await getAuth().listUsers(1000, pageToken);
  for (const user of page.users) {
    const google = user.providerData.find((p) => p.providerId === 'google.com');
    authUsers.push({
      uid: user.uid,
      email: user.email ?? null,
      displayName: user.displayName ?? null,
      photoURL: user.photoURL ?? null,
      googleSub: google?.uid ?? null,
      createdAt: user.metadata.creationTime ? new Date(user.metadata.creationTime).toISOString() : null,
    });
  }
  pageToken = page.pageToken;
} while (pageToken);
console.log(`auth users: ${authUsers.length}`);

await writeFile(
  outFile,
  JSON.stringify({ exportedAt: new Date().toISOString(), authUsers, collections, members }),
);
console.log(`Выгрузка записана в ${outFile}`);
