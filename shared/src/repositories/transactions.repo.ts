import {
  doc,
  type DocumentReference,
  getDocs,
  increment,
  limit as fsLimit,
  orderBy,
  query,
  runTransaction,
  type Transaction as FirestoreWriteTransaction,
  where,
} from 'firebase/firestore';
import type { Debt, Transaction } from '@flowledger/interfaces';
import { getFirestoreInstance } from '../firebase/firebase.js';
import { debtsCollection, transactionsCollection, walletsCollection } from './collections.js';

export interface TransactionFilters {
  walletId?: string;
  categoryId?: string;
  type?: Transaction['type'];
  /** История операций одного долга (см. Debts). */
  debtId?: string;
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
  if (filters.debtId) clauses.push(where('debtId', '==', filters.debtId));
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
 *  debt_lend/debt_borrow двигают один кошелёк как обычная выдача/приход;
 *  debt_repayment — тоже один кошелёк, знак берётся из debtDirection
 *  (снимок Debt.direction на транзакции, см. transaction.interface.ts) —
 *  lent: нам возвращают (+), borrowed: платим мы (-). sign позволяет
 *  применить дельту (1) или отменить её (-1) одной и той же функцией —
 *  используется и для create/delete, и для пересчёта при update. */
function walletDeltas(
  t: Pick<
    Transaction,
    'type' | 'walletId' | 'transferToWalletId' | 'amount' | 'exchangeRate' | 'commissionPercent' | 'debtDirection'
  >,
  sign: 1 | -1,
): Map<string, number> {
  const deltas = new Map<string, number>();
  const add = (walletId: string, amount: number) => deltas.set(walletId, (deltas.get(walletId) ?? 0) + amount);

  if (t.type === 'transfer' && t.transferToWalletId) {
    add(t.walletId, sign * -Math.abs(t.amount));
    add(t.transferToWalletId, sign * Math.abs(t.amount) * effectiveRate(t.exchangeRate, t.commissionPercent));
  } else if (t.type === 'debt_lend') {
    add(t.walletId, sign * -Math.abs(t.amount));
  } else if (t.type === 'debt_borrow') {
    add(t.walletId, sign * Math.abs(t.amount));
  } else if (t.type === 'debt_repayment') {
    const repaymentSign = t.debtDirection === 'borrowed' ? -1 : 1;
    add(t.walletId, sign * repaymentSign * Math.abs(t.amount));
  } else {
    add(t.walletId, sign * signedAmount(t.type, t.amount));
  }

  return deltas;
}

/** Изменение остатка долга (Debt.remainingAmount) от одной операции —
 *  debt_lend/debt_borrow увеличивают остаток (заём выдан/получен),
 *  debt_repayment уменьшает его (частичное/полное погашение). Ключ —
 *  debtId, а не walletId, т.к. это отдельная сущность от кошелька. */
function debtDeltas(t: Pick<Transaction, 'type' | 'debtId' | 'amount'>, sign: 1 | -1): Map<string, number> {
  const deltas = new Map<string, number>();
  if (!t.debtId) return deltas;
  if (t.type === 'debt_lend' || t.type === 'debt_borrow') {
    deltas.set(t.debtId, sign * Math.abs(t.amount));
  } else if (t.type === 'debt_repayment') {
    deltas.set(t.debtId, sign * -Math.abs(t.amount));
  }
  return deltas;
}

function mergeDeltas(target: Map<string, number>, source: Map<string, number>): void {
  for (const [key, delta] of source) {
    target.set(key, (target.get(key) ?? 0) + delta);
  }
}

/**
 * Читает затронутые Debt-документы (все reads в Firestore-транзакции
 * обязаны идти до любых writes — отсюда отдельный проход перед основными
 * tx.set/tx.update) и считает для них конечный remainingAmount/status.
 * remainingAmount хранится обычным числом, а не increment() — statuses
 * ('closed' при remainingAmount === 0) нужно решать по итоговому значению,
 * которое increment() на клиенте недоступен без отдельного чтения, так что
 * читаем в любом случае.
 */
async function readDebtUpdates(
  tx: FirestoreWriteTransaction,
  deltas: Map<string, number>,
): Promise<[DocumentReference<Debt>, Partial<Debt>][]> {
  const updates: [DocumentReference<Debt>, Partial<Debt>][] = [];
  for (const [debtId, delta] of deltas) {
    if (delta === 0) continue;
    const ref = doc(debtsCollection(), debtId);
    const snap = await tx.get(ref);
    const debt = snap.data();
    if (!debt) continue;
    const remainingAmount = Math.max(0, debt.remainingAmount + delta);
    updates.push([ref, { remainingAmount, status: remainingAmount === 0 ? 'closed' : 'active' }]);
  }
  return updates;
}

/**
 * Нет Cloud Function для баланса кошельков (Functions требуют платный
 * Blaze-план), поэтому клиент денормализует wallets.balance сам через
 * атомарную Firestore-транзакцию на create/update/delete. Долги (Debt.
 * remainingAmount) обновляются той же транзакцией по тому же принципу.
 */
export async function createTransaction(
  userId: string,
  input: Omit<Transaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const now = new Date().toISOString();
  const newDocRef = doc(transactionsCollection());

  await runTransaction(getFirestoreInstance(), async (tx) => {
    const debtUpdates = await readDebtUpdates(tx, debtDeltas(input, 1));

    tx.set(newDocRef, { ...input, userId, createdAt: now, updatedAt: now } as Transaction);
    for (const [walletId, delta] of walletDeltas(input, 1)) {
      tx.update(doc(walletsCollection(), walletId), { balance: increment(delta) });
    }
    for (const [debtRef, patch] of debtUpdates) {
      tx.update(debtRef, patch);
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

    const debtChanges = debtDeltas(beforeData, -1);
    mergeDeltas(debtChanges, debtDeltas(after, 1));
    const debtUpdates = await readDebtUpdates(tx, debtChanges);

    tx.update(ref, { ...patch, updatedAt: new Date().toISOString() });

    const walletChanges = walletDeltas(beforeData, -1);
    mergeDeltas(walletChanges, walletDeltas(after, 1));
    for (const [walletId, delta] of walletChanges) {
      if (delta !== 0) {
        tx.update(doc(walletsCollection(), walletId), { balance: increment(delta) });
      }
    }
    for (const [debtRef, debtPatch] of debtUpdates) {
      tx.update(debtRef, debtPatch);
    }
  });
}

export async function deleteTransaction(id: string): Promise<void> {
  const ref = doc(transactionsCollection(), id);

  await runTransaction(getFirestoreInstance(), async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();
    if (!data) return;

    const debtUpdates = await readDebtUpdates(tx, debtDeltas(data, -1));

    tx.delete(ref);
    for (const [walletId, delta] of walletDeltas(data, -1)) {
      tx.update(doc(walletsCollection(), walletId), { balance: increment(delta) });
    }
    for (const [debtRef, patch] of debtUpdates) {
      tx.update(debtRef, patch);
    }
  });
}
