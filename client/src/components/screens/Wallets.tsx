import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useArchiveWallet, useHolders, useUpdateWallet, useWallets } from '@flowledger/shared';
import type { Wallet } from '@flowledger/interfaces';
import type { MainOutletContext } from '@/components/layouts/MainLayout';
import { IconCircle } from '@/components/ui/IconCircle';
import { SwipeableRow } from '@/components/ui/SwipeableRow';
import { ReorderableList } from '@/components/ui/ReorderableList';
import { WalletModal } from '@/components/ui/WalletModal';
import { TransferModal } from '@/components/ui/TransferModal';
import { colorForId } from '@/lib/palette';
import { formatAmount } from '@/lib/format';
import { nextSortOrder } from '@/lib/reorder';
import './forms.css';

export function Wallets() {
  const { user, ownerId } = useOutletContext<MainOutletContext>();
  const { data: wallets, isLoading } = useWallets(ownerId);
  const { data: holders } = useHolders(ownerId);
  const archiveWallet = useArchiveWallet();
  const updateWallet = useUpdateWallet();
  const [openWalletId, setOpenWalletId] = useState<string | null>(null);
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);
  const [showCreateWallet, setShowCreateWallet] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);

  const activeWallets = wallets?.filter((w) => !w.archived) ?? [];
  const archivedWallets = wallets?.filter((w) => w.archived) ?? [];
  const hasHolderAssignments = activeWallets.some((w) => w.holderId);

  function walletRow(w: Wallet, actionLabel: string, actionVariant: 'danger' | 'positive', onAction: () => void) {
    return (
      <SwipeableRow
        actionLabel={actionLabel}
        actionVariant={actionVariant}
        onAction={onAction}
        onClick={() => setEditingWallet(w)}
        open={openWalletId === w.id}
        onOpenChange={(open) => setOpenWalletId(open ? w.id : null)}
      >
        <IconCircle label={w.name} icon={w.icon} color={w.color ?? colorForId(w.id)} size={36} />
        <div className="list-row__main">
          <div className="list-row__title">{w.name}</div>
          <div className="list-row__subtitle">{w.currency}</div>
        </div>
        <span className="wallet-row__amount">
          {formatAmount(w.balance)} {w.currency}
        </span>
      </SwipeableRow>
    );
  }

  /** Долгое нажатие на кошелёк в активном списке (см. ReorderableList) меняет
   *  его sortOrder — порядок дальше используется везде, где выводится
   *  список кошельков (этот экран, WalletPicker в операциях/переводах). */
  function handleReorder(id: string, beforeId: string | null, afterId: string | null) {
    updateWallet.mutate({ id, patch: { sortOrder: nextSortOrder(activeWallets, beforeId, afterId) } });
  }

  return (
    <div className="page">
      <div className="page__header">
        <h1 className="page__title">Кошельки</h1>
        <div className="wallets-header-actions">
          {activeWallets.length >= 2 && (
            <button type="button" className="neo-button neo-button--sm" onClick={() => setShowTransfer(true)}>
              Перевод
            </button>
          )}
          <button
            type="button"
            className="neo-button neo-button--sm neo-button--accent"
            onClick={() => setShowCreateWallet(true)}
          >
            + Кошелёк
          </button>
        </div>
      </div>

      {isLoading && (
        <section className="neo-card">
          <p className="state-message">Загрузка...</p>
        </section>
      )}

      {!isLoading && activeWallets.length === 0 && (
        <section className="neo-card">
          <p className="state-message">Кошельков пока нет</p>
        </section>
      )}

      {!isLoading && !hasHolderAssignments && activeWallets.length > 0 && (
        <section className="neo-card">
          <ReorderableList
            items={activeWallets}
            getId={(w) => w.id}
            onReorder={handleReorder}
            renderItem={(w) => walletRow(w, 'Архив', 'danger', () => archiveWallet.mutate(w.id))}
          />
        </section>
      )}

      {!isLoading &&
        hasHolderAssignments &&
        (holders ?? []).map((h) => {
          const holderWallets = activeWallets.filter((w) => w.holderId === h.id);
          if (holderWallets.length === 0) return null;
          return (
            <section key={h.id} className="neo-card">
              <h2 className="section-title">{h.name}</h2>
              <ReorderableList
                items={holderWallets}
                getId={(w) => w.id}
                onReorder={handleReorder}
                renderItem={(w) => walletRow(w, 'Архив', 'danger', () => archiveWallet.mutate(w.id))}
              />
            </section>
          );
        })}

      {!isLoading && hasHolderAssignments && activeWallets.some((w) => !w.holderId) && (
        <section className="neo-card">
          <h2 className="section-title">Без владельца</h2>
          <ReorderableList
            items={activeWallets.filter((w) => !w.holderId)}
            getId={(w) => w.id}
            onReorder={handleReorder}
            renderItem={(w) => walletRow(w, 'Архив', 'danger', () => archiveWallet.mutate(w.id))}
          />
        </section>
      )}

      {archivedWallets.length > 0 && (
        <section className="neo-card wallets-archived">
          <h2 className="section-title">В архиве</h2>
          {archivedWallets.map((w) => (
            <div key={w.id}>
              {walletRow(w, 'Вернуть', 'positive', () =>
                updateWallet.mutate({ id: w.id, patch: { archived: false } }),
              )}
            </div>
          ))}
        </section>
      )}

      {editingWallet && (
        <WalletModal ownerId={ownerId} wallet={editingWallet} onClose={() => setEditingWallet(null)} />
      )}

      {showCreateWallet && <WalletModal ownerId={ownerId} onClose={() => setShowCreateWallet(false)} />}

      {showTransfer && (
        <TransferModal
          user={user}
          ownerId={ownerId}
          wallets={activeWallets}
          onClose={() => setShowTransfer(false)}
        />
      )}
    </div>
  );
}
