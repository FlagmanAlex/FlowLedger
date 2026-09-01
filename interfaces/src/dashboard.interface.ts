export interface WalletBalanceSummary {
  walletId: string;
  walletName: string;
  currency: string;
  balance: number;
}

export interface CurrencyTotal {
  currency: string;
  total: number;
}

/** categoryId+currency — одна категория, использованная в кошельках
 *  разных валют, даёт отдельную запись на каждую валюту, а не одну
 *  сумму, смешивающую несопоставимые валюты. */
export interface CategoryTotal {
  categoryId: string;
  categoryName: string;
  currency: string;
  total: number;
}

export interface MonthlyTrendPoint {
  month: string;
  currency: string;
  income: number;
  expense: number;
}

export interface DashboardSummary {
  totalBalanceByCurrency: CurrencyTotal[];
  wallets: WalletBalanceSummary[];
  expenseByCategory: CategoryTotal[];
  incomeByCategory: CategoryTotal[];
  monthlyTrend: MonthlyTrendPoint[];
  recentTransactionIds: string[];
}
