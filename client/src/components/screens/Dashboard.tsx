import { Link } from 'react-router-dom';
import { useDashboard, type UseAuthResult } from '@flowledger/shared';
import { useOutletContext } from 'react-router-dom';

export function Dashboard() {
  const { user } = useOutletContext<{ user: UseAuthResult['user'] }>();
  const { summary, isLoading } = useDashboard(user?.tenantId);

  if (isLoading || !summary) {
    return <p>Загрузка дашборда...</p>;
  }

  return (
    <div>
      <h1>Дашборд</h1>

      <section>
        <h2>Общий баланс: {summary.totalBalance.toFixed(2)}</h2>
        <ul>
          {summary.wallets.map((w) => (
            <li key={w.walletId}>
              <Link to={`/wallets/${w.walletId}`}>
                {w.walletName}: {w.balance.toFixed(2)} {w.currency}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Расходы по категориям</h2>
        <ul>
          {summary.expenseByCategory.map((c) => (
            <li key={c.categoryId}>
              <Link to={`/transactions?categoryId=${c.categoryId}`}>
                {c.categoryName}: {c.total.toFixed(2)}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Доходы по категориям</h2>
        <ul>
          {summary.incomeByCategory.map((c) => (
            <li key={c.categoryId}>
              <Link to={`/transactions?categoryId=${c.categoryId}`}>
                {c.categoryName}: {c.total.toFixed(2)}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Тренд по месяцам</h2>
        <Link to="/reports">Подробный отчёт →</Link>
        <ul>
          {summary.monthlyTrend.map((point) => (
            <li key={point.month}>
              {point.month}: доход {point.income.toFixed(2)} / расход {point.expense.toFixed(2)}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Последние операции</h2>
        <Link to="/transactions">Полный журнал →</Link>
      </section>
    </div>
  );
}
