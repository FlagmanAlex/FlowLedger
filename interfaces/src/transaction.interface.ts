export type TransactionType = 'income' | 'expense' | 'transfer';

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
