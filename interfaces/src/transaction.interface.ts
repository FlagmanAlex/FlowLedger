import type { DebtDirection } from './debt.interface.js';

export type TransactionType =
  | 'income'
  | 'expense'
  | 'transfer'
  | 'debt_lend' // выдача займа — деньги уходят из walletId, заводит Debt(direction='lent')
  | 'debt_borrow' // получение займа — деньги приходят в walletId, заводит Debt(direction='borrowed')
  | 'debt_repayment'; // погашение — знак движения по кошельку берётся из debtDirection

export interface Transaction {
  id: string;
  userId: string;
  walletId: string;
  categoryId?: string;
  transferToWalletId?: string;
  /** Курс из валюты walletId в валюту transferToWalletId — только для type
   *  'transfer'. 1, если валюты кошельков совпадают. */
  exchangeRate?: number;
  /** Комиссия банка в процентах — только для type 'transfer' между разными
   *  валютами, уменьшает итоговый курс зачисления. */
  commissionPercent?: number;
  /** Долг, к которому относится операция — только для debt_lend/
   *  debt_borrow/debt_repayment. */
  debtId?: string;
  /** Снимок Debt.direction на момент операции — нужен, чтобы знать знак
   *  движения по кошельку для debt_repayment, не читая сам Debt. */
  debtDirection?: DebtDirection;
  type: TransactionType;
  amount: number;
  description?: string;
  date: string;
  tags?: string[];
  attachments?: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringTemplate {
  id: string;
  userId: string;
  walletId: string;
  categoryId?: string;
  type: TransactionType;
  amount: number;
  description?: string;
  schedule: string;
  nextRunAt: string;
  active: boolean;
}
