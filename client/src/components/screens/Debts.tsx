import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  useCounterparties,
  useDebtOpeningTransaction,
  useDebts,
  useDeleteDebt,
  useHolders,
  useWallets,
} from '@flowledger/shared';
import type { Debt } from '@flowledger/interfaces';
import type { MainOutletContext } from '@/components/layouts/MainLayout';
import { IconCircle } from '@/components/ui/IconCircle';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DebtModal } from '@/components/ui/DebtModal';
import { RepayDebtModal } from '@/components/ui/RepayDebtModal';
import { colorForId } from '@/lib/palette';
import { formatAmount } from '@/lib/format';
import './Debts.css';

export function Debts() {
  const { user, ownerId } = useOutletContext<MainOutletContext>();
  const { data: debts, isLoading } = useDebts(ownerId);
  const { data: wallets } = useWallets(ownerId);
  const { data: holders } = useHolders(ownerId);
  const { data: counterparties } = useCounterparties(ownerId);
  const deleteDebt = useDeleteDebt(ownerId);

  const [showCreate, setShowCreate] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [repayingDebt, setRepayingDebt] = useState<Debt | null>(null);
  const [debtToDelete, setDebtToDelete] = useState<Debt | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { data: editingOpeningTransaction } = useDebtOpeningTransaction(ownerId, editingDebt?.id);

  const activeWallets = (wallets ?? []).filter((w) => !w.archived);
  const all = debts ?? [];
  const lent = all.filter((d) => d.status === 'active' && d.direction === 'lent');
  const borrowed = all.filter((d) => d.status === 'active' && d.direction === 'borrowed');
  const closed = all.filter((d) => d.status === 'closed');

  function walletCurrency(walletId: string): string {
    return (wallets ?? []).find((w) => w.id === walletId)?.currency ?? '';
  }

  function counterpartyName(id: string): string {
    return (counterparties ?? []).find((c) => c.id === id)?.name ?? 'Без контрагента';
  }

  async function handleDeleteDebt() {
    if (!debtToDelete) return;
    setDeleteError(null);
    try {
      await deleteDebt.mutateAsync(debtToDelete.id);
      setDebtToDelete(null);
    } catch (err) {
      console.error('Не удалось удалить долг', err);
      setDeleteError(err instanceof Error ? err.message : 'Не удалось удалить долг');
    }
  }

  function debtCard(d: Debt) {
    const percent = d.principal > 0 ? ((d.principal - d.remainingAmount) / d.principal) * 100 : 100;
    const accent = colorForId(d.id);
    const name = counterpartyName(d.counterpartyId);
    return (
      <div key={d.id} className="debt-card">
        <button type="button" className="list-row list-row--clickable" onClick={() => setEditingDebt(d)}>
          <IconCircle label={name} icon="🤝" color={accent} size={36} />
          <div className="list-row__main">
            <div className="list-row__title">{name}</div>
            <div className="list-row__subtitle">
              {d.status === 'active'
                ? d.direction === 'lent'
                  ? 'Мне должны'
                  : 'Я должен'
                : 'Погашен'}
              {d.dueDate ? ` · до ${d.dueDate}` : ''}
            </div>
          </div>
          <span className={d.status === 'closed' ? 'amount-neutral' : d.direction === 'lent' ? 'amount-positive' : 'amount-negative'}>
            {formatAmount(d.remainingAmount)} {walletCurrency(d.walletId)}
          </span>
        </button>

        {d.status === 'active' && (
          <>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${Math.min(100, percent)}%`, ['--fill-color' as string]: accent }}
              />
            </div>
            <div className="debt-card__actions">
              <button
                type="button"
                className="neo-button neo-button--sm"
                onClick={() => setRepayingDebt(d)}
              >
                Погасить
              </button>
              <button
                type="button"
                className="neo-button neo-button--sm neo-button--danger"
                onClick={() => setDebtToDelete(d)}
              >
                Удалить
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page__header">
        <h1 className="page__title">Долги</h1>
        <button
          type="button"
          className="neo-button neo-button--sm neo-button--accent"
          onClick={() => setShowCreate(true)}
        >
          + Долг
        </button>
      </div>

      {isLoading && (
        <section className="neo-card">
          <p className="state-message">Загрузка...</p>
        </section>
      )}

      {!isLoading && all.length === 0 && (
        <section className="neo-card">
          <p className="state-message">Долгов пока нет</p>
        </section>
      )}

      {lent.length > 0 && (
        <section className="neo-card">
          <h2 className="section-title">Мне должны</h2>
          {lent.map(debtCard)}
        </section>
      )}

      {borrowed.length > 0 && (
        <section className="neo-card">
          <h2 className="section-title">Я должен</h2>
          {borrowed.map(debtCard)}
        </section>
      )}

      {closed.length > 0 && (
        <section className="neo-card debts-closed">
          <h2 className="section-title">Погашенные</h2>
          {closed.map(debtCard)}
        </section>
      )}

      {showCreate && (
        <DebtModal
          user={user}
          ownerId={ownerId}
          wallets={activeWallets}
          holders={holders}
          onClose={() => setShowCreate(false)}
        />
      )}

      {editingDebt && editingOpeningTransaction && (
        <DebtModal
          user={user}
          ownerId={ownerId}
          wallets={wallets ?? []}
          holders={holders}
          debt={editingDebt}
          openingTransaction={editingOpeningTransaction}
          onClose={() => setEditingDebt(null)}
        />
      )}

      {editingDebt && !editingOpeningTransaction && (
        <div className="modal-overlay" onClick={() => setEditingDebt(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <p className="state-message">Загрузка...</p>
          </div>
        </div>
      )}

      {repayingDebt && (
        <RepayDebtModal
          user={user}
          ownerId={ownerId}
          debt={repayingDebt}
          counterpartyName={counterpartyName(repayingDebt.counterpartyId)}
          currency={walletCurrency(repayingDebt.walletId)}
          onClose={() => setRepayingDebt(null)}
        />
      )}

      {debtToDelete && (
        <ConfirmDialog
          title="Удалить долг?"
          message={`«${counterpartyName(debtToDelete.counterpartyId)}» и все связанные операции (выдача/получение, погашения) пропадут из журнала, баланс кошелька пересчитается.`}
          error={deleteError}
          isPending={deleteDebt.isPending}
          onCancel={() => {
            setDeleteError(null);
            setDebtToDelete(null);
          }}
          onConfirm={handleDeleteDebt}
        />
      )}
    </div>
  );
}
