import { useOutletContext } from 'react-router-dom';
import { useDashboard, type UseAuthResult } from '@flowledger/shared';

export function Reports() {
  const { user } = useOutletContext<{ user: UseAuthResult['user'] }>();
  const { summary, isLoading } = useDashboard(user?.uid);

  if (isLoading || !summary) {
    return <p>Загрузка отчётов...</p>;
  }

  return (
    <div>
      <h1>Отчёты</h1>

      <section>
        <h2>Тренд по месяцам</h2>
        <table>
          <thead>
            <tr>
              <th>Месяц</th>
              <th>Доход</th>
              <th>Расход</th>
            </tr>
          </thead>
          <tbody>
            {summary.monthlyTrend.map((point) => (
              <tr key={point.month}>
                <td>{point.month}</td>
                <td>{point.income.toFixed(2)}</td>
                <td>{point.expense.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Расходы по категориям</h2>
        <table>
          <tbody>
            {summary.expenseByCategory.map((c) => (
              <tr key={c.categoryId}>
                <td>{c.categoryName}</td>
                <td>{c.total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Доходы по категориям</h2>
        <table>
          <tbody>
            {summary.incomeByCategory.map((c) => (
              <tr key={c.categoryId}>
                <td>{c.categoryName}</td>
                <td>{c.total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
