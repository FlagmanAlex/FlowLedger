import {
  doc,
  getDocs,
  increment,
  limit as fsLimit,
  orderBy,
  query,
  runTransaction,
  where,
} from 'firebase/firestore';
import type { Transaction } from '@flowledger/interfaces';
import { getFirestoreInstance } from '../firebase/firebase.js';
import { transactionsCollection, walletsCollection } from './collections.js';

export interface TransactionFilters {
  walletId?: string;
  categoryId?: string;
  type?: Transaction['type'];
  limit?: number;
}

export async function listTransactions(
  userId: string,
  filters: TransactionFilters = {},
): Promise<Transaction[]> {
  const clauses = [where('userId', '==', userId)];
  if (filters.walletId) clauses.push(where('walletId', '==', filters.walletId));
  if (filters.categoryId) clauses.push(where('categoryId', '==', filters.categoryId));
  if (filters.type) clauses.push(where('type', '==', filters.type));

  const q = query(
    transactionsCollection(),
    ...clauses,
    orderBy('date', 'desc'),
    fsLimit(filters.limit ?? 100),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

function signedAmount(type: Transaction['type'], amount: number): number {
  return type === 'expense' ? -Math.abs(amount) : Math.abs(amount);
}

/**
 * Нет Cloud Function для баланса кошельков (Functions требуют платный
 * Blaze-план), поэтому клиент денормализует wallets.balance сам через
 * атомарную Firestore-транзакцию на create/update/delete.
 */
export async function createTransaction(
  userId: string,
  input: Omit<Transaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const now = new Date().toISOString();
  const newDocRef = doc(transactionsCollection());

  await runTransaction(getFirestoreInstance(), async (tx) => {
    tx.set(newDocRef, { ...input, userId, createdAt: now, updatedAt: now } as Transaction);
    tx.update(doc(walletsCollection(), input.walletId), {
      balance: increment(signedAmount(input.type, input.amount)),
    });
  });

  return newDocRef.id;
}

export async function updateTransaction(id: string, patch: Partial<Transaction>): Promise<void> {
  const ref = doc(transactionsCollection(), id);

  await runTransaction(getFirestoreInstance(), async (tx) => {
    const before = await tx.get(ref);
    const beforeData = before.data();
    if (!beforeData) throw new Error(`Transaction ${id} not found`);

    const after = { ...beforeData, ...patch };
    tx.update(ref, { ...patch, updatedAt: new Date().toISOString() });

    const beforeDelta = -signedAmount(beforeData.type, beforeData.amount);
    const afterDelta = signedAmount(after.type, after.amount);

    if (beforeData.walletId === after.walletId) {
      if (beforeDelta + afterDelta !== 0) {
        tx.update(doc(walletsCollection(), after.walletId), {
          balance: increment(beforeDelta + afterDelta),
        });
      }
    } else {
      tx.update(doc(walletsCollection(), beforeData.walletId), { balance: increment(beforeDelta) });
      tx.update(doc(walletsCollection(), after.walletId), { balance: increment(afterDelta) });
    }
  });
}

export async function deleteTransaction(id: string): Promise<void> {
  const ref = doc(transactionsCollection(), id);

  await runTransaction(getFirestoreInstance(), async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();
    if (!data) return;

    tx.delete(ref);
    tx.update(doc(walletsCollection(), data.walletId), {
      balance: increment(-signedAmount(data.type, data.amount)),
    });
  });
}
