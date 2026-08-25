import {
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import type { Transaction } from '@flowledger/interfaces';
import { transactionsCollection } from './collections.js';

export interface TransactionFilters {
  walletId?: string;
  categoryId?: string;
  type?: Transaction['type'];
  limit?: number;
}

export async function listTransactions(
  tenantId: string,
  filters: TransactionFilters = {},
): Promise<Transaction[]> {
  const clauses = [where('tenantId', '==', tenantId)];
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

export async function createTransaction(
  input: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const now = new Date().toISOString();
  const ref = await addDoc(transactionsCollection(), {
    ...input,
    createdAt: now,
    updatedAt: now,
  } as Transaction);
  return ref.id;
}

export async function updateTransaction(id: string, patch: Partial<Transaction>): Promise<void> {
  await updateDoc(doc(transactionsCollection(), id), {
    ...patch,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteTransaction(id: string): Promise<void> {
  await deleteDoc(doc(transactionsCollection(), id));
}
