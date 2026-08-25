export type TransactionType = 'income' | 'expense' | 'transfer';

export interface Transaction {
  id: string;
  walletId: string;
  categoryId?: string;
  transferToWalletId?: string;
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
  walletId: string;
  categoryId?: string;
  type: TransactionType;
  amount: number;
  description?: string;
  schedule: string;
  nextRunAt: string;
  active: boolean;
}
