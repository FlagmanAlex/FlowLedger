export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  category: string;
  description?: string;
  date: string;
  type: 'income' | 'expense';
}
