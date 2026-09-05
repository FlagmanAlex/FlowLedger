import { addDoc, deleteDoc, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import type { Debt } from '@flowledger/interfaces';
import { debtsCollection } from './collections.js';
import { createTransaction, deleteTransaction, listTransactions, updateTransaction } from './transactions.repo.js';

/** Открывающая операция долга (debt_lend/debt_borrow) — единственная
 *  связанная транзакция, у которой type не debt_repayment. Нужна, чтобы
 *  дать пользователю править сумму/кошелёк/дату/описание после создания
 *  долга — сами эти поля хранятся не на Debt, а на транзакции. */
export async function getDebtOpeningTransaction(userId: string, debtId: string) {
  const linked = await listTransactions(userId, { debtId });
  return linked.find((t) => t.type !== 'debt_repayment');
}

export async function listDebts(userId: string): Promise<Debt[]> {
  const snap = await getDocs(query(debtsCollection(), where('userId', '==', userId)));
  return snap.docs
    .map((d) => d.data())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export interface CreateDebtInput {
  walletId: string;
  direction: Debt['direction'];
  counterpartyId: string;
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
    counterpartyId: input.counterpartyId,
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

/** Правит карточку долга — контрагент (ссылка на Counterparty), срок.
 *  Направление (lent/borrowed) сюда не входит: поменять его значило бы
 *  перевернуть знак движения кошелька у уже сделанных погашений (снимок
 *  debtDirection на каждой из них), а не только у открывающей операции —
 *  для редкой опечатки проще удалить долг и завести заново. Сумма/
 *  кошелёк/дата/описание открывающей операции — через updateDebtOpening
 *  ниже, не здесь. */
export async function updateDebt(
  id: string,
  patch: Partial<Pick<Debt, 'counterpartyId' | 'dueDate'>>,
): Promise<void> {
  await updateDoc(doc(debtsCollection(), id), patch);
}

export interface UpdateDebtOpeningInput {
  walletId: string;
  principal: number;
  date: string;
  description?: string;
}

/**
 * Правит открывающую операцию долга (сумму/кошелёк/дату/описание) —
 * через updateTransaction, ту же атомарную runTransaction, что и у любой
 * другой операции: она уже сама пересчитывает и баланс кошелька(ов), и
 * Debt.remainingAmount по дельте между старой и новой суммой (см.
 * transactions.repo.ts). Debt.principal отдельным вызовом сдвигается на
 * ту же дельту — remainingAmount транзакция поправила, а principal
 * (используется в проценте прогресса) на ней не завязан.
 */
export async function updateDebtOpening(
  debt: Debt,
  openingTransactionId: string,
  input: UpdateDebtOpeningInput,
): Promise<void> {
  const repaidSoFar = debt.principal - debt.remainingAmount;
  if (input.principal < repaidSoFar) {
    throw new Error(`Сумма не может быть меньше уже погашенной части (${repaidSoFar})`);
  }

  await updateTransaction(openingTransactionId, {
    walletId: input.walletId,
    amount: input.principal,
    date: input.date,
    description: input.description,
  });

  if (input.principal !== debt.principal) {
    await updateDoc(doc(debtsCollection(), debt.id), { principal: input.principal });
  }
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
