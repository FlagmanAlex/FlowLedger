import { Form, useOutletContext, useSearchParams } from 'react-router-dom';
import { useCategories, useTransactions, useWallets, type UseAuthResult } from '@flowledger/shared';

export function Transactions() {
  const { user } = useOutletContext<{ user: UseAuthResult['user'] }>();
  const [searchParams] = useSearchParams();
  const categoryId = searchParams.get('categoryId') ?? undefined;

  const { data: wallets } = useWallets(user?.uid);
  const { data: categories } = useCategories(user?.uid);
  const { data: transactions, isLoading } = useTransactions(user?.uid, { categoryId });

  return (
    <div>
      <h1>Журнал операций</h1>

      <Form method="post">
        <select name="walletId" required>
          {wallets?.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
        <select name="categoryId" required>
          {categories?.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select name="type" required>
          <option value="expense">Расход</option>
          <option value="income">Доход</option>
        </select>
        <input type="number" step="0.01" name="amount" placeholder="Сумма" required />
        <input type="date" name="date" required />
        <input type="text" name="description" placeholder="Описание" />
        <button type="submit">Добавить</button>
      </Form>

      {isLoading && <p>Загрузка...</p>}
      <ul>
        {transactions?.map((t) => (
          <li key={t.id}>
            {t.date} — {t.type === 'expense' ? '-' : '+'}{Math.abs(t.amount).toFixed(2)} — {t.description}
          </li>
        ))}
      </ul>
    </div>
  );
}
