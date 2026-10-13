import { ObjectId, type ClientSession, type Db, type MongoClient } from 'mongodb';
import type { Transaction } from '@flowledger/interfaces';
import {
  debtsCollection,
  transactionsCollection,
  walletsCollection,
  type TransactionDoc,
} from './collections.js';
import { badRequest } from './http.js';

/** Поля операции, которые задаёт клиент (остальное — сервер). */
export type TransactionInput = Omit<
  Transaction,
  'id' | 'userId' | 'createdBy' | 'createdAt' | 'updatedAt'
>;

/** Выполняет fn в транзакции Mongo (replica set обязателен): операция,
 *  балансы кошельков и остатки долгов меняются атомарно. */
export async function inTransaction<T>(
  client: MongoClient,
  fn: (session: ClientSession) => Promise<T>,
): Promise<T> {
  return client.withSession((session) => session.withTransaction(() => fn(session)));
}

function signedAmount(type: Transaction['type'], amount: number): number {
  return type === 'expense' ? -Math.abs(amount) : Math.abs(amount);
}

/** Итоговый курс перевода — номинальный курс, уменьшенный на комиссию банка. */
function effectiveRate(exchangeRate = 1, commissionPercent = 0): number {
  return exchangeRate * (1 - commissionPercent / 100);
}

type DeltaSource = Pick<
  Transaction,
  | 'type'
  | 'walletId'
  | 'transferToWalletId'
  | 'amount'
  | 'exchangeRate'
  | 'commissionPercent'
  | 'debtDirection'
  | 'debtId'
>;

/** Изменение баланса по каждому затронутому кошельку от одной операции —
 *  для income/expense это один кошелёк, для transfer сразу два (списание в
 *  валюте источника, зачисление в валюте назначения по effectiveRate).
 *  debt_lend/debt_borrow двигают один кошелёк как выдача/приход;
 *  debt_repayment — знак из debtDirection (lent: нам возвращают +,
 *  borrowed: платим мы −). sign: 1 — применить, −1 — отменить. Перенесено
 *  из shared/repositories/transactions.repo.ts без изменений логики. */
export function walletDeltas(t: DeltaSource, sign: 1 | -1): Map<string, number> {
  const deltas = new Map<string, number>();
  const add = (walletId: string, amount: number) =>
    deltas.set(walletId, (deltas.get(walletId) ?? 0) + amount);

  if (t.type === 'transfer' && t.transferToWalletId) {
    add(t.walletId, sign * -Math.abs(t.amount));
    add(
      t.transferToWalletId,
      sign * Math.abs(t.amount) * effectiveRate(t.exchangeRate, t.commissionPercent),
    );
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

/** Изменение остатка долга: debt_lend/debt_borrow увеличивают остаток,
 *  debt_repayment уменьшает. Ключ — debtId. */
export function debtDeltas(t: DeltaSource, sign: 1 | -1): Map<string, number> {
  const deltas = new Map<string, number>();
  if (!t.debtId) return deltas;
  if (t.type === 'debt_lend' || t.type === 'debt_borrow') {
    deltas.set(t.debtId, sign * Math.abs(t.amount));
  } else if (t.type === 'debt_repayment') {
    deltas.set(t.debtId, sign * -Math.abs(t.amount));
  }
  return deltas;
}

function mergeDeltas(target: Map<string, number>, source: Map<string, number>) {
  for (const [key, delta] of source) {
    target.set(key, (target.get(key) ?? 0) + delta);
  }
  return target;
}

/** Балансы кошельков. Кошелёк ищется в той же базе (userId), что и
 *  операция — чужой кошелёк по id не задеть. */
async function applyWalletDeltas(
  db: Db,
  session: ClientSession,
  ownerId: string,
  deltas: Map<string, number>,
) {
  for (const [walletId, delta] of deltas) {
    if (delta === 0) continue;
    const result = await walletsCollection(db).updateOne(
      { _id: walletId, userId: ownerId },
      { $inc: { balance: delta } },
      { session },
    );
    if (result.matchedCount === 0) {
      throw badRequest(`Кошелёк ${walletId} не найден в этой базе`);
    }
  }
}

/** Остатки долгов: итоговое значение не ниже нуля, при нуле — closed. Долг,
 *  которого уже нет, пропускается (как и раньше в Firestore-версии). */
async function applyDebtDeltas(
  db: Db,
  session: ClientSession,
  ownerId: string,
  deltas: Map<string, number>,
) {
  for (const [debtId, delta] of deltas) {
    if (delta === 0) continue;
    const debt = await debtsCollection(db).findOne({ _id: debtId, userId: ownerId }, { session });
    if (!debt) continue;
    const remainingAmount = Math.max(0, debt.remainingAmount + delta);
    await debtsCollection(db).updateOne(
      { _id: debtId },
      { $set: { remainingAmount, status: remainingAmount === 0 ? 'closed' : 'active' } },
      { session },
    );
  }
}

export async function createTransactionIn(
  db: Db,
  session: ClientSession,
  ownerId: string,
  input: TransactionInput,
  createdBy: string,
): Promise<string> {
  const now = new Date().toISOString();
  const id = new ObjectId().toHexString();
  await transactionsCollection(db).insertOne(
    { ...input, _id: id, userId: ownerId, createdBy, createdAt: now, updatedAt: now },
    { session },
  );
  await applyWalletDeltas(db, session, ownerId, walletDeltas(input, 1));
  await applyDebtDeltas(db, session, ownerId, debtDeltas(input, 1));
  return id;
}

/** Правка: отменяет вклад старой версии операции и применяет новую. */
export async function updateTransactionIn(
  db: Db,
  session: ClientSession,
  before: TransactionDoc,
  patch: Partial<TransactionInput>,
): Promise<void> {
  const after = { ...before, ...patch };
  await transactionsCollection(db).updateOne(
    { _id: before._id },
    { $set: { ...patch, updatedAt: new Date().toISOString() } },
    { session },
  );
  await applyWalletDeltas(
    db,
    session,
    before.userId,
    mergeDeltas(walletDeltas(before, -1), walletDeltas(after, 1)),
  );
  await applyDebtDeltas(
    db,
    session,
    before.userId,
    mergeDeltas(debtDeltas(before, -1), debtDeltas(after, 1)),
  );
}

export async function deleteTransactionIn(
  db: Db,
  session: ClientSession,
  doc: TransactionDoc,
): Promise<void> {
  await transactionsCollection(db).deleteOne({ _id: doc._id }, { session });
  await applyWalletDeltas(db, session, doc.userId, walletDeltas(doc, -1));
  await applyDebtDeltas(db, session, doc.userId, debtDeltas(doc, -1));
}
