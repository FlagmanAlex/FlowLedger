/** lent — я дал в долг (мне должны), borrowed — я взял в долг (я должен). */
export type DebtDirection = 'lent' | 'borrowed';

export type DebtCounterpartyType = 'person' | 'bank';

/** 'closed' проставляется автоматически, когда remainingAmount доходит до
 *  0 — не выставляется руками пользователем. */
export type DebtStatus = 'active' | 'closed';

/**
 * Долг обязательно привязан к кошельку — сумма движется по его балансу как
 * обычная операция (см. Transaction.debtId, типы debt_lend/debt_borrow/
 * debt_repayment). Валюта долга отдельно не хранится — берётся из
 * Wallet.currency привязанного walletId, чтобы не рассинхронизироваться.
 */
export interface Debt {
  id: string;
  userId: string;
  walletId: string;
  direction: DebtDirection;
  counterpartyType: DebtCounterpartyType;
  counterpartyName: string;
  principal: number;
  /** Текущий остаток — обновляется той же атомарной транзакцией, что и
   *  баланс кошелька (см. transactions.repo.ts), никогда не редактируется
   *  напрямую. */
  remainingAmount: number;
  dueDate?: string;
  status: DebtStatus;
  createdBy: string;
  createdAt: string;
}
