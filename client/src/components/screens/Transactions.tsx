import { useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { useCategories, useTransactions, useWallets } from '@flowledger/shared';
import type { Transaction, TransactionType } from '@flowledger/interfaces';
import type { MainOutletContext } from '@/components/layouts/MainLayout';
import { IconCircle } from '@/components/ui/IconCircle';
import { AddTransactionModal } from '@/components/ui/AddTransactionModal';
import { colorForId } from '@/lib/palette';
import { formatAmount, formatDateHeader } from '@/lib/format';
import './Transactions.css';

type TxFilter = 'all' | 'income' | 'expense';

function groupByDate(transactions: Transaction[]) {
  const groups: { date: string; items: Transaction[] }[] = [];
  for (const t of transactions) {
    const last = groups.at(-1);
    if (last && last.date === t.date) {
      last.items.push(t);
    } else {
      groups.push({ date: t.date, items: [t] });
    }
  }
  return groups;
}

export function Transactions() {
  const { user, ownerId } = useOutletContext<MainOutletContext>();
  const [searchParams] = useSearchParams();
  const categoryId = searchParams.get('categoryId') ?? undefined;

  const [filter, setFilter] = useState<TxFilter>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [addType, setAddType] = useState<TransactionType>('expense');
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  const { data: wallets } = useWallets(ownerId);
  const { data: categories } = useCategories(ownerId);
  const { data: transactions, isLoading } = useTransactions(ownerId, { categoryId });

  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]));
  const walletById = new Map((wallets ?? []).map((w) => [w.id, w]));

  const filtered = (transactions ?? []).filter((t) => filter === 'all' || t.type === filter);
  const groups = groupByDate(filtered);

  function openAdd(type: TransactionType) {
    setAddType(type);
    setShowAdd(true);
  }

  return (
    <div className="page">
      <h1 className="page__title">Журнал</h1>

      <div className="segmented transactions-filter">
        <button
          type="button"
          className={`segmented__item${filter === 'all' ? ' is-active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Все
        </button>
        <button
          type="button"
          className={`segmented__item${filter === 'income' ? ' is-active' : ''}`}
          onClick={() => setFilter('income')}
        >
          Доходы
        </button>
        <button
          type="button"
          className={`segmented__item${filter === 'expense' ? ' is-active' : ''}`}
          onClick={() => setFilter('expense')}
        >
          Расходы
        </button>
      </div>

      <section className="neo-card">
        {isLoading && <p className="state-message">Загрузка...</p>}
        {!isLoading && groups.length === 0 && <p className="state-message">Операций пока нет</p>}
        {groups.map((group) => (
          <div key={group.date}>
            <div className="date-header">{formatDateHeader(group.date)}</div>
            {group.items.map((t) => {
              const category = t.categoryId ? categoryById.get(t.categoryId) : undefined;
              const wallet = walletById.get(t.walletId);
              return (
                <button
                  key={t.id}
                  type="button"
                  className="list-row list-row--clickable"
                  onClick={() => setEditingTx(t)}
                >
                  <IconCircle
                    label={category?.name ?? '·'}
                    color={category ? category.color ?? colorForId(category.id) : colorForId(t.walletId)}
                    size={38}
                  />
                  <div className="list-row__main">
                    <div className="list-row__title">
                      {category?.name ?? t.description ?? 'Операция'}
                    </div>
                    <div className="list-row__subtitle">{wallet?.name ?? ''}</div>
                  </div>
                  <div className={t.type === 'expense' ? 'amount-negative' : 'amount-positive'}>
                    {t.type === 'expense' ? '−' : '+'}
                    {formatAmount(Math.abs(t.amount))} ₽
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </section>

      <button type="button" className="fab" onClick={() => openAdd('expense')} aria-label="Добавить операцию">
        +
      </button>

      {showAdd && (
        <AddTransactionModal
          user={user}
          ownerId={ownerId}
          wallets={(wallets ?? []).filter((w) => !w.archived)}
          categories={categories ?? []}
          defaultType={addType}
          onClose={() => setShowAdd(false)}
        />
      )}

      {editingTx && (
        <AddTransactionModal
          user={user}
          ownerId={ownerId}
          wallets={wallets ?? []}
          categories={categories ?? []}
          defaultType={editingTx.type === 'expense' ? 'expense' : 'income'}
          transaction={editingTx}
          onClose={() => setEditingTx(null)}
        />
      )}
    </div>
  );
}
