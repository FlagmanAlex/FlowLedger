import { Link, useOutletContext } from 'react-router-dom';
import { useCategories, useDashboard, useTransactions, useWallets } from '@flowledger/shared';
import type { MainOutletContext } from '@/components/layouts/MainLayout';
import { IconCircle } from '@/components/ui/IconCircle';
import { CategoryBar } from '@/components/ui/CategoryBar';
import { colorForId } from '@/lib/palette';
import { formatAmount, formatMonthLong, formatMonthShort } from '@/lib/format';
import './Dashboard.css';

export function Dashboard() {
  const { ownerId } = useOutletContext<MainOutletContext>();
  const { summary, isLoading, error } = useDashboard(ownerId);
  const { data: wallets } = useWallets(ownerId);
  const { data: categories } = useCategories(ownerId);
  const { data: recentTransactions } = useTransactions(ownerId, { limit: 4 });

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

  const expenseTotal = summary.expenseByCategory.reduce((sum, c) => sum + c.total, 0);
  const incomeTotal = summary.incomeByCategory.reduce((sum, c) => sum + c.total, 0);

  const trendPoints = summary.monthlyTrend.slice(-6);
  const trendMax = Math.max(1, ...trendPoints.flatMap((p) => [p.income, p.expense]));
  const lastPoint = summary.monthlyTrend.at(-1);
  const delta = lastPoint ? lastPoint.income - lastPoint.expense : undefined;

  return (
    <div className="page">
      <div className="dashboard-header">
        <h1 className="page__title">Дашборд</h1>
        <span className="dashboard-header__month">{formatMonthLong(new Date())}</span>
      </div>

      <section className="neo-card">
        <div className="balance-label">Общий баланс</div>
        <div className="balance-value">
          {formatAmount(summary.totalBalance)} ₽
        </div>
        {delta !== undefined && (
          <div className={`delta-pill${delta < 0 ? ' delta-pill--negative' : ''}`}>
            {delta >= 0 ? '+' : '−'}
            {formatAmount(Math.abs(delta))} ₽ за {formatMonthShort(lastPoint!.month)}
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

      {expenseTotal > 0 && (
        <section className="neo-card">
          <h2 className="section-title">Расходы по категориям</h2>
          <div className="category-list">
            {summary.expenseByCategory.map((c) => (
              <Link
                key={c.categoryId}
                to={`/transactions?categoryId=${c.categoryId}`}
                className="card-link"
              >
                <CategoryBar
                  name={c.categoryName}
                  amount={c.total}
                  percent={(c.total / expenseTotal) * 100}
                  color={categoryById.get(c.categoryId)?.color ?? colorForId(c.categoryId)}
                />
              </Link>
            ))}
          </div>
        </section>
      )}

      {incomeTotal > 0 && (
        <section className="neo-card">
          <h2 className="section-title">Доходы по категориям</h2>
          <div className="category-list">
            {summary.incomeByCategory.map((c) => (
              <Link
                key={c.categoryId}
                to={`/transactions?categoryId=${c.categoryId}`}
                className="card-link"
              >
                <CategoryBar
                  name={c.categoryName}
                  amount={c.total}
                  percent={(c.total / incomeTotal) * 100}
                  color={categoryById.get(c.categoryId)?.color ?? colorForId(c.categoryId)}
                />
              </Link>
            ))}
          </div>
        </section>
      )}

      {trendPoints.length > 0 && (
        <section className="neo-card">
          <h2 className="section-title">Тренд по месяцам</h2>
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
      )}

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
            return (
              <div key={t.id} className="list-row">
                <IconCircle
                  label={category?.name ?? '·'}
                  color={category ? category.color ?? colorForId(category.id) : colorForId(t.walletId)}
                  size={36}
                />
                <div className="list-row__main">
                  <div className="list-row__title">
                    {category?.name ?? (t.categoryId ? 'Без категории' : t.description ?? 'Операция')}
                  </div>
                  <div className="list-row__subtitle">{wallet?.name ?? ''}</div>
                </div>
                <div
                  className={`recent-row__amount ${t.type === 'expense' ? 'amount-negative' : 'amount-positive'}`}
                >
                  {t.type === 'expense' ? '−' : '+'}
                  {formatAmount(Math.abs(t.amount))} ₽
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
