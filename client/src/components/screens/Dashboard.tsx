import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useCategories, useDashboard, useTransactions, useWallets } from '@flowledger/shared';
import type { MonthlyTrendPoint } from '@flowledger/interfaces';
import type { MainOutletContext } from '@/components/layouts/MainLayout';
import { IconCircle } from '@/components/ui/IconCircle';
import { CategoryBar } from '@/components/ui/CategoryBar';
import { colorForId } from '@/lib/palette';
import { formatAmount, formatMonthLong, formatMonthShort } from '@/lib/format';
import './Dashboard.css';

const MAIN_CURRENCY = 'RUB';

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthDateRange(month: string): { dateFrom: string; dateTo: string } {
  const [year, m] = month.split('-').map(Number);
  const pad = (n: number) => String(n).padStart(2, '0');
  const from = new Date(year, m - 1, 1);
  const to = new Date(year, m, 1);
  return {
    dateFrom: `${from.getFullYear()}-${pad(from.getMonth() + 1)}-${pad(from.getDate())}`,
    dateTo: `${to.getFullYear()}-${pad(to.getMonth() + 1)}-${pad(to.getDate())}`,
  };
}

/** Последние 12 месяцев, включая текущий — диапазон выбора в пикере. */
function recentMonthOptions(): { value: string; label: string }[] {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return { value: monthKey(d), label: formatMonthLong(d) };
  });
}

export function Dashboard() {
  const { ownerId } = useOutletContext<MainOutletContext>();
  const { summary, isLoading, error } = useDashboard(ownerId);
  const { data: wallets } = useWallets(ownerId);
  const { data: categories } = useCategories(ownerId);
  const { data: recentTransactions } = useTransactions(ownerId, { limit: 4 });

  const [selectedMonth, setSelectedMonth] = useState(() => monthKey(new Date()));
  const { dateFrom, dateTo } = monthDateRange(selectedMonth);
  const { data: monthTransactions } = useTransactions(ownerId, { dateFrom, dateTo, limit: 500 });

  if (error) {
    return (
      <div className="page">
        <p className="state-message" role="alert">
          Не удалось загрузить дашборд: {error.message}
        </p>
      </div>
    );
  }

  if (isLoading || !summary) {
    return (
      <div className="page">
        <p className="state-message">Загрузка дашборда...</p>
      </div>
    );
  }

  const walletColorById = new Map((wallets ?? []).map((w) => [w.id, w.color ?? colorForId(w.id)]));
  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]));
  const walletById = new Map((wallets ?? []).map((w) => [w.id, w]));

  const trendByCurrency = new Map<string, MonthlyTrendPoint[]>();
  for (const p of summary.monthlyTrend) {
    const arr = trendByCurrency.get(p.currency) ?? [];
    arr.push(p);
    trendByCurrency.set(p.currency, arr);
  }
  const trendBlocks = Array.from(trendByCurrency.entries()).map(([currency, points]) => {
    const trendPoints = points.slice(-6);
    const trendMax = Math.max(1, ...trendPoints.flatMap((p) => [p.income, p.expense]));
    return { currency, trendPoints, trendMax };
  });

  const lastMonth = summary.monthlyTrend.at(-1)?.month;
  const deltas = lastMonth
    ? summary.monthlyTrend
        .filter((p) => p.month === lastMonth)
        .map((p) => ({ currency: p.currency, month: p.month, delta: p.income - p.expense }))
    : [];

  // Основная валюта — рубли: категории и итоги за выбранный месяц считаем
  // только по RUB-кошелькам, не смешивая с другими валютами.
  const rubWalletIds = new Set(
    (wallets ?? []).filter((w) => w.currency === MAIN_CURRENCY).map((w) => w.id),
  );
  const monthExpenseByCategory = new Map<string, number>();
  const monthIncomeByCategory = new Map<string, number>();
  let monthExpenseTotal = 0;
  let monthIncomeTotal = 0;
  for (const t of monthTransactions ?? []) {
    if (!rubWalletIds.has(t.walletId)) continue;
    if (t.type === 'expense' && t.categoryId) {
      const amount = Math.abs(t.amount);
      monthExpenseByCategory.set(t.categoryId, (monthExpenseByCategory.get(t.categoryId) ?? 0) + amount);
      monthExpenseTotal += amount;
    } else if (t.type === 'income' && t.categoryId) {
      const amount = Math.abs(t.amount);
      monthIncomeByCategory.set(t.categoryId, (monthIncomeByCategory.get(t.categoryId) ?? 0) + amount);
      monthIncomeTotal += amount;
    }
  }
  const toSortedTotals = (map: Map<string, number>) =>
    Array.from(map.entries())
      .map(([categoryId, total]) => ({ categoryId, total }))
      .sort((a, b) => b.total - a.total);
  const monthExpenseList = toSortedTotals(monthExpenseByCategory);
  const monthIncomeList = toSortedTotals(monthIncomeByCategory);

  return (
    <div className="page">
      <div className="dashboard-header">
        <h1 className="page__title">Дашборд</h1>
        <span className="dashboard-header__month">{formatMonthLong(new Date())}</span>
      </div>

      <section className="neo-card">
        <div className="balance-label">Общий баланс</div>
        {summary.totalBalanceByCurrency.length <= 1 ? (
          <div className="balance-value">
            {formatAmount(summary.totalBalanceByCurrency[0]?.total ?? 0)}{' '}
            {summary.totalBalanceByCurrency[0]?.currency ?? ''}
          </div>
        ) : (
          <div className="balance-value-list">
            {summary.totalBalanceByCurrency.map((b) => (
              <div key={b.currency} className="balance-value-list__item">
                {formatAmount(b.total)} {b.currency}
              </div>
            ))}
          </div>
        )}
        {deltas.length > 0 && (
          <div className="delta-pill-row">
            {deltas.map((d) => (
              <div
                key={d.currency}
                className={`delta-pill${d.delta < 0 ? ' delta-pill--negative' : ''}`}
              >
                {d.delta >= 0 ? '+' : '−'}
                {formatAmount(Math.abs(d.delta))} {d.currency} за {formatMonthShort(d.month)}
              </div>
            ))}
          </div>
        )}
      </section>

      {summary.wallets.length > 0 && (
        <div className="wallets-row">
          {summary.wallets.map((w) => (
            <Link key={w.walletId} to="/wallets" className="card-link neo-card--sm wallet-card">
              <div
                className="wallet-bar"
                style={{ background: walletColorById.get(w.walletId) ?? colorForId(w.walletId) }}
              />
              <div className="wallet-name">{w.walletName}</div>
              <div className="wallet-balance">
                {formatAmount(w.balance)} {w.currency}
              </div>
            </Link>
          ))}
        </div>
      )}

      <section className="neo-card">
        <div className="dashboard-month-summary__header">
          <h2 className="section-title" style={{ margin: 0 }}>
            За месяц
          </h2>
          <select
            className="neo-input dashboard-month-select"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            {recentMonthOptions().map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="dashboard-month-totals">
          <div className="dashboard-month-totals__item">
            <span className="dashboard-month-totals__label">Доходы</span>
            <span className="dashboard-month-totals__value amount-positive">
              +{formatAmount(monthIncomeTotal)} {MAIN_CURRENCY}
            </span>
          </div>
          <div className="dashboard-month-totals__item">
            <span className="dashboard-month-totals__label">Расходы</span>
            <span className="dashboard-month-totals__value amount-negative">
              −{formatAmount(monthExpenseTotal)} {MAIN_CURRENCY}
            </span>
          </div>
        </div>
      </section>

      <section className="neo-card">
        <h2 className="section-title">Расходы по категориям</h2>
        {monthExpenseList.length === 0 ? (
          <p className="state-message">Нет данных за этот месяц</p>
        ) : (
          <div className="category-list">
            {monthExpenseList.map((c) => (
              <Link
                key={c.categoryId}
                to={`/transactions?categoryId=${c.categoryId}`}
                className="card-link"
              >
                <CategoryBar
                  name={categoryById.get(c.categoryId)?.name ?? 'Без категории'}
                  amount={c.total}
                  currency={MAIN_CURRENCY}
                  percent={(c.total / (monthExpenseTotal || 1)) * 100}
                  color={categoryById.get(c.categoryId)?.color ?? colorForId(c.categoryId)}
                />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="neo-card">
        <h2 className="section-title">Доходы по категориям</h2>
        {monthIncomeList.length === 0 ? (
          <p className="state-message">Нет данных за этот месяц</p>
        ) : (
          <div className="category-list">
            {monthIncomeList.map((c) => (
              <Link
                key={c.categoryId}
                to={`/transactions?categoryId=${c.categoryId}`}
                className="card-link"
              >
                <CategoryBar
                  name={categoryById.get(c.categoryId)?.name ?? 'Без категории'}
                  amount={c.total}
                  currency={MAIN_CURRENCY}
                  percent={(c.total / (monthIncomeTotal || 1)) * 100}
                  color={categoryById.get(c.categoryId)?.color ?? colorForId(c.categoryId)}
                />
              </Link>
            ))}
          </div>
        )}
      </section>

      {trendBlocks.map(({ currency, trendPoints, trendMax }) => (
        <section key={currency} className="neo-card">
          <h2 className="section-title">
            Тренд по месяцам{trendBlocks.length > 1 ? ` — ${currency}` : ''}
          </h2>
          <div className="trend-bars">
            {trendPoints.map((p) => (
              <div key={p.month} className="trend-month">
                <div className="trend-bar-pair">
                  <div
                    className="trend-bar trend-bar--income"
                    style={{ height: `${(p.income / trendMax) * 64}px` }}
                  />
                  <div
                    className="trend-bar trend-bar--expense"
                    style={{ height: `${(p.expense / trendMax) * 64}px` }}
                  />
                </div>
                <span className="trend-label">{formatMonthShort(p.month)}</span>
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="neo-card">
        <div className="recent-header">
          <h2 className="section-title" style={{ margin: 0 }}>
            Последние операции
          </h2>
          <Link to="/transactions" className="recent-link">
            Все →
          </Link>
        </div>
        {recentTransactions?.length ? (
          recentTransactions.map((t) => {
            const category = t.categoryId ? categoryById.get(t.categoryId) : undefined;
            const wallet = walletById.get(t.walletId);
            const isTransfer = t.type === 'transfer';
            return (
              <div key={t.id} className="list-row">
                <IconCircle
                  label={isTransfer ? '⇄' : category?.name ?? '·'}
                  color={category ? category.color ?? colorForId(category.id) : colorForId(t.walletId)}
                  size={36}
                />
                <div className="list-row__main">
                  <div className="list-row__title">
                    {isTransfer
                      ? 'Перевод'
                      : category?.name ?? (t.categoryId ? 'Без категории' : t.description ?? 'Операция')}
                  </div>
                  <div className="list-row__subtitle">{wallet?.name ?? ''}</div>
                </div>
                <div
                  className={`recent-row__amount ${isTransfer ? 'amount-neutral' : t.type === 'expense' ? 'amount-negative' : 'amount-positive'}`}
                >
                  {!isTransfer && (t.type === 'expense' ? '−' : '+')}
                  {formatAmount(Math.abs(t.amount))} {wallet?.currency ?? ''}
                </div>
              </div>
            );
          })
        ) : (
          <p className="state-message">Операций пока нет</p>
        )}
      </section>
    </div>
  );
}
