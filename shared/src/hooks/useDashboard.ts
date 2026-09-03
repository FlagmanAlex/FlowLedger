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
 *
 * Кошельки бывают разных валют — суммировать их в одно число бессмысленно
 * без курсов конвертации (не входит в эту функцию), поэтому баланс,
 * категории и тренд по месяцам считаются отдельно на каждую валюту.
 */
export function useDashboard(userId: string | undefined) {
  const enabled = Boolean(userId);

  const walletsQuery = useQuery({
    queryKey: ['wallets', userId],
    queryFn: () => listWallets(userId!),
    enabled,
  });
  const categoriesQuery = useQuery({
    queryKey: ['categories', userId],
    queryFn: () => listCategories(userId!),
    enabled,
  });
  const transactionsQuery = useQuery({
    queryKey: ['transactions', userId, { limit: 500 }],
    queryFn: () => listTransactions(userId!, { limit: 500 }),
    enabled,
  });

  const summary = useMemo<DashboardSummary | undefined>(() => {
    if (!walletsQuery.data || !categoriesQuery.data || !transactionsQuery.data) return undefined;

    const categoryNameById = new Map(categoriesQuery.data.map((c) => [c.id, c.name]));
    const walletById = new Map(walletsQuery.data.map((w) => [w.id, w]));

    const balanceByCurrency = new Map<string, number>();
    for (const w of walletsQuery.data) {
      balanceByCurrency.set(w.currency, (balanceByCurrency.get(w.currency) ?? 0) + w.balance);
    }

    const expenseByCategory = new Map<string, number>();
    const incomeByCategory = new Map<string, number>();
    const monthlyTrend = new Map<string, { month: string; currency: string; income: number; expense: number }>();

    for (const tx of transactionsQuery.data) {
      const currency = walletById.get(tx.walletId)?.currency ?? '';
      const month = tx.date.slice(0, 7);
      const trendKey = `${month}|${currency}`;
      const point = monthlyTrend.get(trendKey) ?? { month, currency, income: 0, expense: 0 };

      if (tx.type === 'expense' && tx.categoryId) {
        const key = `${tx.categoryId}|${currency}`;
        expenseByCategory.set(key, (expenseByCategory.get(key) ?? 0) + Math.abs(tx.amount));
        point.expense += Math.abs(tx.amount);
      } else if (tx.type === 'income' && tx.categoryId) {
        const key = `${tx.categoryId}|${currency}`;
        incomeByCategory.set(key, (incomeByCategory.get(key) ?? 0) + Math.abs(tx.amount));
        point.income += Math.abs(tx.amount);
      }
      monthlyTrend.set(trendKey, point);
    }

    const toCategoryTotals = (map: Map<string, number>): CategoryTotal[] =>
      Array.from(map.entries())
        .map(([key, total]) => {
          const [categoryId, currency] = key.split('|');
          return {
            categoryId,
            currency,
            categoryName: categoryNameById.get(categoryId) ?? 'Без категории',
            total,
          };
        })
        .sort((a, b) => b.total - a.total);

    const trend: MonthlyTrendPoint[] = Array.from(monthlyTrend.values()).sort(
      (a, b) => a.month.localeCompare(b.month) || a.currency.localeCompare(b.currency),
    );

    return {
      totalBalanceByCurrency: Array.from(balanceByCurrency.entries())
        .map(([currency, total]) => ({ currency, total }))
        .sort((a, b) => b.total - a.total),
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
    error: walletsQuery.error ?? categoriesQuery.error ?? transactionsQuery.error,
  };
}
