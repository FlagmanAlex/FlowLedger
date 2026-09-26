import { useEffect, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { useCategories, useCounterparties, useDebts, useHolders, useTransactions, useWallets } from '@flowledger/shared';
import type { Transaction, TransactionType } from '@flowledger/interfaces';
import type { MainOutletContext } from '@/components/layouts/MainLayout';
import { IconCircle } from '@/components/ui/IconCircle';
import { AddTransactionModal } from '@/components/ui/AddTransactionModal';
import { TransferModal } from '@/components/ui/TransferModal';
import { QueryError } from '@/components/ui/QueryError';
import { colorForId } from '@/lib/palette';
import { formatAmount, formatDateHeader, formatMonthLong } from '@/lib/format';
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

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(month: string): string {
  const [year, m] = month.split('-').map(Number);
  return formatMonthLong(new Date(year, m - 1, 1));
}

/** Месяцы для пикера — только те, где реально есть загруженные операции
 *  (с учётом текущих фильтров категории/кошелька), плюс текущий месяц
 *  всегда доступен как выбор по умолчанию, даже без операций. */
function monthOptions(transactions: Transaction[]): { value: string; label: string }[] {
  const months = new Set(transactions.map((t) => t.date.slice(0, 7)));
  months.add(currentMonthKey());
  return Array.from(months)
    .sort()
    .reverse()
    .map((value) => ({ value, label: monthLabel(value) }));
}

export function Transactions() {
  const { user, ownerId } = useOutletContext<MainOutletContext>();
  const [searchParams] = useSearchParams();
  const categoryId = searchParams.get('categoryId') ?? undefined;
  const walletId = searchParams.get('walletId') ?? undefined;

  const [filter, setFilter] = useState<TxFilter>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [addType, setAddType] = useState<TransactionType>('expense');
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editingTransfer, setEditingTransfer] = useState<Transaction | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => currentMonthKey());

  /** Разные кошельки/категории — разная история, при смене фильтра сбрасываем
   *  выбранный месяц обратно на текущий, а не оставляем месяц предыдущего
   *  выбора, в котором у нового может не быть операций. */
  useEffect(() => {
    setSelectedMonth(currentMonthKey());
  }, [walletId, categoryId]);

  const { data: wallets, error: walletsError } = useWallets(ownerId);
  const { data: categories, error: categoriesError } = useCategories(ownerId);
  const { data: holders } = useHolders(ownerId);
  const { data: debts } = useDebts(ownerId);
  const { data: counterparties } = useCounterparties(ownerId);
  const { data: transactions, isLoading, error } = useTransactions(ownerId, { categoryId, walletId, limit: 500 });
  const loadError = error ?? walletsError ?? categoriesError;

  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]));
  const walletById = new Map((wallets ?? []).map((w) => [w.id, w]));
  const holderById = new Map((holders ?? []).map((h) => [h.id, h]));
  const debtById = new Map((debts ?? []).map((d) => [d.id, d]));
  const counterpartyById = new Map((counterparties ?? []).map((c) => [c.id, c]));
  const walletNameCounts = new Map<string, number>();
  for (const w of wallets ?? []) {
    walletNameCounts.set(w.name, (walletNameCounts.get(w.name) ?? 0) + 1);
  }

  /** У двух кошельков разных владельцев может совпадать название — тогда
   *  подписи «Кошелёк» под операцией недостаточно, чтобы понять, о какой
   *  именно карте речь. Добавляем владельца впереди, только если название
   *  неоднозначно (иначе не загромождаем обычный случай). */
  function walletLabel(walletId: string | undefined): string {
    const wallet = walletId ? walletById.get(walletId) : undefined;
    if (!wallet) return '';
    const isAmbiguous = (walletNameCounts.get(wallet.name) ?? 0) > 1;
    const holder = wallet.holderId ? holderById.get(wallet.holderId) : undefined;
    return isAmbiguous && holder ? `${holder.name} ▪️${wallet.name}` : wallet.name;
  }

  const periodTransactions = (transactions ?? []).filter((t) => t.date.slice(0, 7) === selectedMonth);
  const filtered = periodTransactions.filter((t) => filter === 'all' || t.type === filter);
  const groups = groupByDate(filtered);

  const MAIN_CURRENCY = 'RUB';

  /** Суммы под вкладками Все/Приход/Расход — за выбранный месяц и текущие
   *  фильтры категории/кошелька, только по RUB-кошелькам (как и «За месяц»
   *  на Главной — операции в другой валюте не смешиваются в одно число).
   *  Переводы и операции по долгам в суммы не входят — они не доход/расход,
   *  а просто движение денег. */
  let incomeTotal = 0;
  let expenseTotal = 0;
  for (const t of periodTransactions) {
    if (t.type !== 'income' && t.type !== 'expense') continue;
    if (walletById.get(t.walletId)?.currency !== MAIN_CURRENCY) continue;
    if (t.type === 'income') incomeTotal += Math.abs(t.amount);
    else expenseTotal += Math.abs(t.amount);
  }
  const netTotal = incomeTotal - expenseTotal;

  function openAdd(type: TransactionType) {
    setAddType(type);
    setShowAdd(true);
  }

  return (
    <div className="page">
      <h1 className="page__title">Журнал</h1>

      <select
        className="neo-input transactions-month-select"
        value={selectedMonth}
        onChange={(e) => setSelectedMonth(e.target.value)}
      >
        {monthOptions(transactions ?? []).map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>

      <div className="segmented transactions-filter">
        <button
          type="button"
          className={`segmented__item${filter === 'all' ? ' is-active' : ''}`}
          onClick={() => setFilter('all')}
        >
          <span>Все</span>
          <span className="segmented__amount amount-neutral">
            {netTotal >= 0 ? '+' : '−'}
            {formatAmount(Math.abs(netTotal))} {MAIN_CURRENCY}
          </span>
        </button>
        <button
          type="button"
          className={`segmented__item${filter === 'income' ? ' is-active' : ''}`}
          onClick={() => setFilter('income')}
        >
          <span>Приход</span>
          <span className="segmented__amount amount-positive">
            +{formatAmount(incomeTotal)} {MAIN_CURRENCY}
          </span>
        </button>
        <button
          type="button"
          className={`segmented__item${filter === 'expense' ? ' is-active' : ''}`}
          onClick={() => setFilter('expense')}
        >
          <span>Расход</span>
          <span className="segmented__amount amount-negative">
            −{formatAmount(expenseTotal)} {MAIN_CURRENCY}
          </span>
        </button>
      </div>

      <section className="neo-card">
        <QueryError error={loadError} label="Не удалось загрузить операции" />
        {isLoading && !loadError && <p className="state-message">Загрузка...</p>}
        {!isLoading && !loadError && groups.length === 0 && (
          <p className="state-message">Операций за этот месяц нет</p>
        )}
        {groups.map((group) => (
          <div key={group.date}>
            <div className="date-header">{formatDateHeader(group.date)}</div>
            {group.items.map((t) => {
              const wallet = walletById.get(t.walletId);

              if (t.type === 'transfer') {
                /* На странице кошелька-получателя показываем сумму зачисления в его
                 *  валюте (после курса и комиссии), а не списанную сумму в валюте
                 *  источника — иначе на другой стороне перевода цифры не сходятся
                 *  с тем, что реально пришло на этот кошелёк. */
                const showingDestination = Boolean(walletId) && walletId === t.transferToWalletId && walletId !== t.walletId;
                const toWallet = t.transferToWalletId ? walletById.get(t.transferToWalletId) : undefined;
                const effectiveRate = (t.exchangeRate ?? 1) * (1 - (t.commissionPercent ?? 0) / 100);
                const displayAmount = showingDestination ? Math.abs(t.amount) * effectiveRate : Math.abs(t.amount);
                const displayCurrency = showingDestination ? toWallet?.currency : wallet?.currency;
                return (
                  <button
                    key={t.id}
                    type="button"
                    className="list-row list-row--clickable"
                    onClick={() => setEditingTransfer(t)}
                  >
                    <IconCircle label="⇄" color={colorForId(t.walletId)} size={38} />
                    <div className="list-row__main">
                      <div className="list-row__title">Перевод</div>
                      <div className="list-row__subtitle">
                        {walletLabel(t.walletId)} → {walletLabel(t.transferToWalletId)}
                      </div>
                      {t.description && (
                        <div className="list-row__description">{t.description}</div>
                      )}
                    </div>
                    <div className="amount-neutral">
                      {formatAmount(displayAmount)} {displayCurrency ?? ''}
                    </div>
                  </button>
                );
              }

              if (t.type === 'debt_lend' || t.type === 'debt_borrow' || t.type === 'debt_repayment') {
                const debt = t.debtId ? debtById.get(t.debtId) : undefined;
                const name = (debt ? counterpartyById.get(debt.counterpartyId)?.name : undefined) ?? 'Долг';
                const title =
                  t.type === 'debt_lend'
                    ? `Выдача займа — ${name}`
                    : t.type === 'debt_borrow'
                      ? `Получение займа — ${name}`
                      : t.debtDirection === 'lent'
                        ? `Возврат долга — ${name}`
                        : `Погашение долга — ${name}`;
                const isPositive = t.type === 'debt_borrow' || (t.type === 'debt_repayment' && t.debtDirection === 'lent');
                return (
                  <div key={t.id} className="list-row">
                    <IconCircle
                      label={name}
                      icon="🤝"
                      color={debt ? colorForId(debt.id) : colorForId(t.walletId)}
                      size={38}
                    />
                    <div className="list-row__main">
                      <div className="list-row__title">{title}</div>
                      <div className="list-row__subtitle">{walletLabel(t.walletId)}</div>
                      {t.description && <div className="list-row__description">{t.description}</div>}
                    </div>
                    <div className={isPositive ? 'amount-positive' : 'amount-negative'}>
                      {isPositive ? '+' : '−'}
                      {formatAmount(Math.abs(t.amount))} {wallet?.currency ?? ''}
                    </div>
                  </div>
                );
              }

              const category = t.categoryId ? categoryById.get(t.categoryId) : undefined;
              return (
                <button
                  key={t.id}
                  type="button"
                  className="list-row list-row--clickable"
                  onClick={() => setEditingTx(t)}
                >
                  <IconCircle
                    label={category?.name ?? '·'}
                    icon={category?.icon}
                    color={category ? category.color ?? colorForId(category.id) : colorForId(t.walletId)}
                    size={38}
                  />
                  <div className="list-row__main">
                    <div className="list-row__title">
                      {category?.name ?? (t.categoryId ? 'Без категории' : t.description ?? 'Операция')}
                    </div>
                    <div className="list-row__subtitle">{walletLabel(t.walletId)}</div>
                    {t.description && <div className="list-row__description">{t.description}</div>}
                  </div>
                  <div className={t.type === 'expense' ? 'amount-negative' : 'amount-positive'}>
                    {t.type === 'expense' ? '−' : '+'}
                    {formatAmount(Math.abs(t.amount))} {wallet?.currency ?? ''}
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
          defaultWalletId={walletId}
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

      {editingTransfer && (
        <TransferModal
          user={user}
          ownerId={ownerId}
          wallets={wallets ?? []}
          transaction={editingTransfer}
          onClose={() => setEditingTransfer(null)}
        />
      )}
    </div>
  );
}
