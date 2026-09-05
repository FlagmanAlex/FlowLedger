import { addDoc, deleteDoc, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import type { Debt } from '@flowledger/interfaces';
import { debtsCollection } from './collections.js';
import { createTransaction, deleteTransaction, listTransactions } from './transactions.repo.js';

export async function listDebts(userId: string): Promise<Debt[]> {
  const snap = await getDocs(query(debtsCollection(), where('userId', '==', userId)));
  return snap.docs
    .map((d) => d.data())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export interface CreateDebtInput {
  walletId: string;
  direction: Debt['direction'];
  counterpartyType: Debt['counterpartyType'];
  counterpartyName: string;
  principal: number;
  dueDate?: string;
  date: string;
  description?: string;
}

/**
 * Заводит долг и сразу создаёт открывающую операцию в общем журнале
 * (debt_lend/debt_borrow) — она же двигает баланс кошелька. remainingAmount
 * стартует с 0 и доводится до principal той же дельтой, которую
 * createTransaction применяет к любой debt_* операции (см.
 * transactions.repo.ts) — единая логика для создания долга и его
 * последующих правок/погашений, а не отдельная ветка здесь.
 */
export async function createDebt(
  userId: string,
  input: CreateDebtInput,
  createdBy: string,
): Promise<string> {
  const ref = await addDoc(debtsCollection(), {
    userId,
    walletId: input.walletId,
    direction: input.direction,
    counterpartyType: input.counterpartyType,
    counterpartyName: input.counterpartyName,
    principal: input.principal,
    remainingAmount: 0,
    dueDate: input.dueDate,
    status: 'active',
    createdBy,
    createdAt: new Date().toISOString(),
  } as Debt);

  await createTransaction(userId, {
    walletId: input.walletId,
    debtId: ref.id,
    debtDirection: input.direction,
    type: input.direction === 'lent' ? 'debt_lend' : 'debt_borrow',
    amount: input.principal,
    description: input.description,
    date: input.date,
    createdBy,
  });

  return ref.id;
}

/** Правится только карточка долга (контрагент, срок) — сумма и остаток
 *  меняются исключительно через операции журнала (создание/погашение),
 *  не напрямую. */
export async function updateDebt(
  id: string,
  patch: Partial<Pick<Debt, 'counterpartyName' | 'counterpartyType' | 'dueDate'>>,
): Promise<void> {
  await updateDoc(doc(debtsCollection(), id), patch);
}

export interface RepayDebtInput {
  amount: number;
  date: string;
  description?: string;
}

/** Погашение (частичное или полное) — обычная операция журнала (type
 *  debt_repayment) с debtId; знак движения по кошельку решает
 *  debt.direction, снимок которого кладётся на транзакцию. */
export async function repayDebt(
  userId: string,
  debt: Debt,
  input: RepayDebtInput,
  createdBy: string,
): Promise<string> {
  return createTransaction(userId, {
    walletId: debt.walletId,
    debtId: debt.id,
    debtDirection: debt.direction,
    type: 'debt_repayment',
    amount: input.amount,
    description: input.description,
    date: input.date,
    createdBy,
  });
}

/** Удаляет долг вместе со всеми связанными операциями (открытие +
 *  погашения) из общего журнала — каждая через deleteTransaction, чтобы
 *  баланс кошелька откатился так же, как при обычном удалении операции. */
export async function deleteDebt(userId: string, id: string): Promise<void> {
  const linked = await listTransactions(userId, { debtId: id, limit: 1000 });
  for (const t of linked) {
    await deleteTransaction(t.id);
  }
  await deleteDoc(doc(debtsCollection(), id));
}
