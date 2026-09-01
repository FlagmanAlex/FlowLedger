import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useOutletContext } from 'react-router-dom';
import {
  useArchiveWallet,
  useCreateWallet,
  useUpdateWallet,
  useWallets,
  walletFormSchema,
  type WalletFormValues,
} from '@flowledger/shared';
import type { Wallet } from '@flowledger/interfaces';
import type { MainOutletContext } from '@/components/layouts/MainLayout';
import { IconCircle } from '@/components/ui/IconCircle';
import { SwipeableRow } from '@/components/ui/SwipeableRow';
import { EditWalletModal } from '@/components/ui/EditWalletModal';
import { colorForId } from '@/lib/palette';
import { formatAmount } from '@/lib/format';
import './forms.css';

export function Wallets() {
  const { ownerId } = useOutletContext<MainOutletContext>();
  const { data: wallets, isLoading } = useWallets(ownerId);
  const createWallet = useCreateWallet(ownerId);
  const archiveWallet = useArchiveWallet();
  const updateWallet = useUpdateWallet();
  const [openWalletId, setOpenWalletId] = useState<string | null>(null);
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);

  const activeWallets = wallets?.filter((w) => !w.archived) ?? [];
  const archivedWallets = wallets?.filter((w) => w.archived) ?? [];

  const { register, handleSubmit, reset, formState } = useForm<WalletFormValues>({
    resolver: zodResolver(walletFormSchema),
    defaultValues: { name: '', currency: 'USD' },
  });

  async function onSubmit(values: WalletFormValues) {
    if (!ownerId) return;
    await createWallet.mutateAsync(values);
    reset();
  }

  return (
    <div className="page">
      <h1 className="page__title">Кошельки</h1>

      <section className="neo-card">
        <form className="create-form" onSubmit={handleSubmit(onSubmit)}>
          <div className="field">
            <input className="neo-input" placeholder="Название" {...register('name')} />
            {formState.errors.name && (
              <span className="field__error">{formState.errors.name.message}</span>
            )}
          </div>
          <div className="field">
            <input className="neo-input" placeholder="Валюта" {...register('currency')} />
          </div>
          <button type="submit" className="neo-button neo-button--accent" disabled={createWallet.isPending}>
            Добавить
          </button>
        </form>
      </section>

      <section className="neo-card">
        {isLoading && <p className="state-message">Загрузка...</p>}
        {activeWallets.map((w) => (
          <SwipeableRow
            key={w.id}
            actionLabel="Архив"
            actionVariant="danger"
            onAction={() => archiveWallet.mutate(w.id)}
            onClick={() => setEditingWallet(w)}
            open={openWalletId === w.id}
            onOpenChange={(open) => setOpenWalletId(open ? w.id : null)}
          >
            <IconCircle label={w.name} color={w.color ?? colorForId(w.id)} size={36} />
            <div className="list-row__main">
              <div className="list-row__title">{w.name}</div>
              <div className="list-row__subtitle">{w.currency}</div>
            </div>
            <span className="wallet-row__amount">
              {formatAmount(w.balance)} {w.currency}
            </span>
          </SwipeableRow>
        ))}
        {!isLoading && activeWallets.length === 0 && (
          <p className="state-message">Кошельков пока нет</p>
        )}
      </section>

      {archivedWallets.length > 0 && (
        <section className="neo-card wallets-archived">
          <h2 className="section-title">В архиве</h2>
          {archivedWallets.map((w) => (
            <SwipeableRow
              key={w.id}
              actionLabel="Вернуть"
              actionVariant="positive"
              onAction={() => updateWallet.mutate({ id: w.id, patch: { archived: false } })}
              onClick={() => setEditingWallet(w)}
              open={openWalletId === w.id}
              onOpenChange={(open) => setOpenWalletId(open ? w.id : null)}
            >
              <IconCircle label={w.name} color={w.color ?? colorForId(w.id)} size={36} />
              <div className="list-row__main">
                <div className="list-row__title">{w.name}</div>
                <div className="list-row__subtitle">{w.currency}</div>
              </div>
              <span className="wallet-row__amount">
                {formatAmount(w.balance)} {w.currency}
              </span>
            </SwipeableRow>
          ))}
        </section>
      )}

      {editingWallet && (
        <EditWalletModal wallet={editingWallet} onClose={() => setEditingWallet(null)} />
      )}
    </div>
  );
}
