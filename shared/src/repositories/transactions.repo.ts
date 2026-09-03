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
  /** Включительно, формат YYYY-MM-DD — фильтр по месяцу и т.п. Использует
   *  тот же составной индекс userId+date, что и сортировка, новый не нужен. */
  dateFrom?: string;
  /** Исключительно (< dateTo), формат YYYY-MM-DD. */
  dateTo?: string;
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
  if (filters.dateFrom) clauses.push(where('date', '>=', filters.dateFrom));
  if (filters.dateTo) clauses.push(where('date', '<', filters.dateTo));

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

/** Итоговый курс перевода — номинальный курс, уменьшенный на комиссию банка. */
function effectiveRate(exchangeRate = 1, commissionPercent = 0): number {
  return exchangeRate * (1 - commissionPercent / 100);
}

/** Изменение баланса по каждому затронутому кошельку от одной операции —
 *  для income/expense это один кошелёк, для transfer сразу два (списание
 *  в валюте источника, зачисление в валюте назначения по effectiveRate).
 *  sign позволяет применить дельту (1) или отменить её (-1) одной и той
 *  же функцией — используется и для create/delete, и для пересчёта при
 *  update. */
function walletDeltas(
  t: Pick<Transaction, 'type' | 'walletId' | 'transferToWalletId' | 'amount' | 'exchangeRate' | 'commissionPercent'>,
  sign: 1 | -1,
): Map<string, number> {
  const deltas = new Map<string, number>();
  const add = (walletId: string, amount: number) => deltas.set(walletId, (deltas.get(walletId) ?? 0) + amount);

  if (t.type === 'transfer' && t.transferToWalletId) {
    add(t.walletId, sign * -Math.abs(t.amount));
    add(t.transferToWalletId, sign * Math.abs(t.amount) * effectiveRate(t.exchangeRate, t.commissionPercent));
  } else {
    add(t.walletId, sign * signedAmount(t.type, t.amount));
  }

  return deltas;
}

function mergeDeltas(target: Map<string, number>, source: Map<string, number>): void {
  for (const [walletId, delta] of source) {
    target.set(walletId, (target.get(walletId) ?? 0) + delta);
  }
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
    for (const [walletId, delta] of walletDeltas(input, 1)) {
      tx.update(doc(walletsCollection(), walletId), { balance: increment(delta) });
    }
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

    const deltas = walletDeltas(beforeData, -1);
    mergeDeltas(deltas, walletDeltas(after, 1));

    for (const [walletId, delta] of deltas) {
      if (delta !== 0) {
        tx.update(doc(walletsCollection(), walletId), { balance: increment(delta) });
      }
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
    for (const [walletId, delta] of walletDeltas(data, -1)) {
      tx.update(doc(walletsCollection(), walletId), { balance: increment(delta) });
    }
  });
}
