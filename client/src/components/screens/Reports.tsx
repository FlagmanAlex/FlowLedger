import { useOutletContext } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useCategories, useDashboard } from '@flowledger/shared';
import type { MonthlyTrendPoint } from '@flowledger/interfaces';
import type { MainOutletContext } from '@/components/layouts/MainLayout';
import { CategoryBar } from '@/components/ui/CategoryBar';
import { colorForId } from '@/lib/palette';
import { formatMonthShort } from '@/lib/format';
import './Reports.css';

export function Reports() {
  const { ownerId } = useOutletContext<MainOutletContext>();
  const { summary, isLoading } = useDashboard(ownerId);
  const { data: categories } = useCategories(ownerId);

  if (isLoading || !summary) {
    return (
      <div className="page">
        <p className="state-message">Загрузка отчётов...</p>
      </div>
    );
  }

  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]));

  // Кошельки бывают разных валют — итоги для процентов и график тренда
  // считаем на каждую валюту отдельно, а не смешивая их в одно число.
  const expenseTotalByCurrency = new Map<string, number>();
  for (const c of summary.expenseByCategory) {
    expenseTotalByCurrency.set(c.currency, (expenseTotalByCurrency.get(c.currency) ?? 0) + c.total);
  }
  const incomeTotalByCurrency = new Map<string, number>();
  for (const c of summary.incomeByCategory) {
    incomeTotalByCurrency.set(c.currency, (incomeTotalByCurrency.get(c.currency) ?? 0) + c.total);
  }

  const trendByCurrency = new Map<string, MonthlyTrendPoint[]>();
  for (const p of summary.monthlyTrend) {
    const arr = trendByCurrency.get(p.currency) ?? [];
    arr.push(p);
    trendByCurrency.set(p.currency, arr);
  }
  const trendBlocks = Array.from(trendByCurrency.entries()).map(([currency, points]) => ({
    currency,
    chartData: points.map((p) => ({ ...p, label: formatMonthShort(p.month) })),
  }));

  return (
    <div className="page">
      <h1 className="page__title">Отчёты</h1>

      {trendBlocks.length === 0 && (
        <section className="neo-card">
          <h2 className="section-title">Тренд по месяцам</h2>
          <p className="state-message">Пока нет данных</p>
        </section>
      )}

      {trendBlocks.map(({ currency, chartData }) => (
        <section key={currency} className="neo-card">
          <h2 className="section-title">
            Тренд по месяцам{trendBlocks.length > 1 ? ` — ${currency}` : ''}
          </h2>
          <div className="reports-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(245,246,250,0.08)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'rgba(245,246,250,0.5)', fontSize: 11 }}
                  axisLine={{ stroke: 'rgba(245,246,250,0.08)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'rgba(245,246,250,0.5)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(245,246,250,0.04)' }}
                  contentStyle={{
                    background: '#1b2136',
                    border: 'none',
                    borderRadius: 12,
                    boxShadow: '5px 5px 10px #12141c, -5px -5px 10px #242c49',
                  }}
                  labelStyle={{ color: 'rgba(245,246,250,0.5)' }}
                  itemStyle={{ color: '#f5f6fa' }}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: 'rgba(245,246,250,0.5)' }} />
                <Bar dataKey="income" name="Доход" fill="#2fe6b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Расход" fill="#ff5c7a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      ))}

      <div className="reports-columns">
        <section className="neo-card">
          <h2 className="section-title">Расходы по категориям</h2>
          <div className="category-list">
            {summary.expenseByCategory.length === 0 && <p className="state-message">Нет данных</p>}
            {summary.expenseByCategory.map((c) => (
              <CategoryBar
                key={`${c.categoryId}-${c.currency}`}
                name={c.categoryName}
                amount={c.total}
                currency={c.currency}
                percent={(c.total / (expenseTotalByCurrency.get(c.currency) || 1)) * 100}
                color={categoryById.get(c.categoryId)?.color ?? colorForId(c.categoryId)}
              />
            ))}
          </div>
        </section>

        <section className="neo-card">
          <h2 className="section-title">Доходы по категориям</h2>
          <div className="category-list">
            {summary.incomeByCategory.length === 0 && <p className="state-message">Нет данных</p>}
            {summary.incomeByCategory.map((c) => (
              <CategoryBar
                key={`${c.categoryId}-${c.currency}`}
                name={c.categoryName}
                amount={c.total}
                currency={c.currency}
                percent={(c.total / (incomeTotalByCurrency.get(c.currency) || 1)) * 100}
                color={categoryById.get(c.categoryId)?.color ?? colorForId(c.categoryId)}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
