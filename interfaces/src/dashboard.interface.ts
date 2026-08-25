export interface WalletBalanceSummary {
  walletId: string;
  walletName: string;
  currency: string;
  balance: number;
}

export interface CategoryTotal {
  categoryId: string;
  categoryName: string;
  total: number;
}

export interface MonthlyTrendPoint {
  month: string;
  income: number;
  expense: number;
}

export interface DashboardSummary {
  totalBalance: number;
  wallets: WalletBalanceSummary[];
  expenseByCategory: CategoryTotal[];
  incomeByCategory: CategoryTotal[];
  monthlyTrend: MonthlyTrendPoint[];
  recentTransactionIds: string[];
}
