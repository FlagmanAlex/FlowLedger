import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CategoryTotal, DashboardSummary, MonthlyTrendPoint } from '@flowledger/interfaces';
import { listWallets } from '../repositories/wallets.repo.js';
import { listTransactions } from '../repositories/transactions.repo.js';
import { listCategories } from '../repositories/categories.repo.js';

/**
 * Computes dashboard aggregates client-side from the same denormalized
 * wallet balances and a bounded transaction window — avoids a server round
 * trip for the common case; a Cloud Function-backed aggregate can replace
 * this later if the transaction volume outgrows client-side aggregation.
 */
export function useDashboard(enabled: boolean) {
  const walletsQuery = useQuery({
    queryKey: ['wallets'],
    queryFn: listWallets,
    enabled,
  });
  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: listCategories,
    enabled,
  });
  const transactionsQuery = useQuery({
    queryKey: ['transactions', { limit: 500 }],
    queryFn: () => listTransactions({ limit: 500 }),
    enabled,
  });

  const summary = useMemo<DashboardSummary | undefined>(() => {
    if (!walletsQuery.data || !categoriesQuery.data || !transactionsQuery.data) return undefined;

    const categoryNameById = new Map(categoriesQuery.data.map((c) => [c.id, c.name]));
    const expenseByCategory = new Map<string, number>();
    const incomeByCategory = new Map<string, number>();
    const monthlyTrend = new Map<string, { income: number; expense: number }>();

    for (const tx of transactionsQuery.data) {
      const month = tx.date.slice(0, 7);
      const point = monthlyTrend.get(month) ?? { income: 0, expense: 0 };

      if (tx.type === 'expense' && tx.categoryId) {
        expenseByCategory.set(tx.categoryId, (expenseByCategory.get(tx.categoryId) ?? 0) + Math.abs(tx.amount));
        point.expense += Math.abs(tx.amount);
      } else if (tx.type === 'income' && tx.categoryId) {
        incomeByCategory.set(tx.categoryId, (incomeByCategory.get(tx.categoryId) ?? 0) + Math.abs(tx.amount));
        point.income += Math.abs(tx.amount);
      }
      monthlyTrend.set(month, point);
    }

    const toCategoryTotals = (map: Map<string, number>): CategoryTotal[] =>
      Array.from(map.entries())
        .map(([categoryId, total]) => ({
          categoryId,
          categoryName: categoryNameById.get(categoryId) ?? 'Unknown',
          total,
        }))
        .sort((a, b) => b.total - a.total);

    const trend: MonthlyTrendPoint[] = Array.from(monthlyTrend.entries())
      .map(([month, v]) => ({ month, ...v }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return {
      totalBalance: walletsQuery.data.reduce((sum, w) => sum + w.balance, 0),
      wallets: walletsQuery.data.map((w) => ({
        walletId: w.id,
        walletName: w.name,
        currency: w.currency,
        balance: w.balance,
      })),
      expenseByCategory: toCategoryTotals(expenseByCategory),
      incomeByCategory: toCategoryTotals(incomeByCategory),
      monthlyTrend: trend,
      recentTransactionIds: transactionsQuery.data.slice(0, 10).map((t) => t.id),
    };
  }, [walletsQuery.data, categoriesQuery.data, transactionsQuery.data]);

  return {
    summary,
    isLoading: walletsQuery.isLoading || categoriesQuery.isLoading || transactionsQuery.isLoading,
  };
}
