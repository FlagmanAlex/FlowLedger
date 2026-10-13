import type { Debt } from '@flowledger/interfaces';
import { apiRequest } from '../api/client.js';
import { listTransactions } from './transactions.repo.js';

/** Открывающая операция долга (debt_lend/debt_borrow) — единственная
 *  связанная транзакция, у которой type не debt_repayment. Нужна, чтобы
 *  дать пользователю править сумму/кошелёк/дату/описание после создания
 *  долга — сами эти поля хранятся не на Debt, а на транзакции. */
export async function getDebtOpeningTransaction(userId: string, debtId: string) {
  const linked = await listTransactions(userId, { debtId });
  return linked.find((t) => t.type !== 'debt_repayment');
}

/** Долги базы, новые сверху. */
export async function listDebts(userId: string): Promise<Debt[]> {
  return apiRequest<Debt[]>('/debts', { query: { ownerId: userId } });
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
 * Заводит долг вместе с открывающей операцией в общем журнале
 * (debt_lend/debt_borrow) — сервер делает это одной транзакцией Mongo:
 * операция двигает баланс кошелька и доводит remainingAmount до principal.
 * createdBy сервер берёт из сессии.
 */
export async function createDebt(
  userId: string,
  input: CreateDebtInput,
  _createdBy: string,
): Promise<string> {
  const { id } = await apiRequest<{ id: string }>('/debts', {
    method: 'POST',
    body: { ...input, ownerId: userId },
  });
  return id;
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
  await apiRequest(`/debts/${id}`, { method: 'PATCH', body: patch });
}

export interface UpdateDebtOpeningInput {
  walletId: string;
  principal: number;
  date: string;
  description?: string;
}

/**
 * Правит открывающую операцию долга (сумму/кошелёк/дату/описание) и
 * синхронно Debt.principal/walletId — сервер делает это одной транзакцией
 * вместе с пересчётом баланса кошелька(ов) и remainingAmount. Сумма меньше
 * уже погашенной части отклоняется (и здесь, и на сервере).
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
  await apiRequest(`/debts/${debt.id}/opening`, {
    method: 'PUT',
    body: { ...input, openingTransactionId },
  });
}

export interface RepayDebtInput {
  amount: number;
  date: string;
  description?: string;
}

/** Погашение (частичное или полное) — операция журнала debt_repayment по
 *  кошельку долга; знак движения по кошельку — из debt.direction. */
export async function repayDebt(
  _userId: string,
  debt: Debt,
  input: RepayDebtInput,
  _createdBy: string,
): Promise<string> {
  const { id } = await apiRequest<{ id: string }>(`/debts/${debt.id}/repay`, {
    method: 'POST',
    body: input,
  });
  return id;
}

/** Удаляет долг вместе со всеми его операциями (открытие + погашения) —
 *  балансы кошельков откатываются; на сервере одной транзакцией. */
export async function deleteDebt(_userId: string, id: string): Promise<void> {
  await apiRequest(`/debts/${id}`, { method: 'DELETE' });
}
