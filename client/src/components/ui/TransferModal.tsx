import { useState } from 'react';
import {
  useCreateTransaction,
  useDeleteTransaction,
  useUpdateTransaction,
  type UseAuthResult,
} from '@flowledger/shared';
import type { Transaction, Wallet } from '@flowledger/interfaces';
import { colorForId } from '@/lib/palette';
import { formatAmount } from '@/lib/format';
import './TransferModal.css';

interface TransferModalProps {
  user: UseAuthResult['user'];
  ownerId: string | undefined;
  wallets: Wallet[];
  transaction?: Transaction;
  onClose: () => void;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function toNumber(value: string): number {
  return Number(value.replace(',', '.'));
}

export function TransferModal({ user, ownerId, wallets, transaction, onClose }: TransferModalProps) {
  const createTransaction = useCreateTransaction(ownerId);
  const updateTransaction = useUpdateTransaction();
  const deleteTransaction = useDeleteTransaction();
  const isEditing = Boolean(transaction);

  const [fromWalletId, setFromWalletId] = useState<string | undefined>(
    transaction?.walletId ?? wallets[0]?.id,
  );
  const [toWalletId, setToWalletId] = useState<string | undefined>(
    transaction?.transferToWalletId ?? wallets.find((w) => w.id !== wallets[0]?.id)?.id,
  );
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : '');
  const [exchangeRateInput, setExchangeRateInput] = useState(String(transaction?.exchangeRate ?? 1));
  const [commissionInput, setCommissionInput] = useState(
    transaction?.commissionPercent ? String(transaction.commissionPercent) : '',
  );
  const [description, setDescription] = useState(transaction?.description ?? '');
  const [date, setDate] = useState(transaction?.date ?? today());
  const [error, setError] = useState<string | null>(null);

  const fromWallet = wallets.find((w) => w.id === fromWalletId);
  const toWallet = wallets.find((w) => w.id === toWalletId);
  const sameCurrency = Boolean(fromWallet && toWallet && fromWallet.currency === toWallet.currency);

  const numericAmount = toNumber(amount) || 0;
  const rateValue = sameCurrency ? 1 : toNumber(exchangeRateInput) || 0;
  const commissionValue = sameCurrency ? 0 : toNumber(commissionInput || '0') || 0;
  const effectiveRate = rateValue * (1 - commissionValue / 100);
  const creditedAmount = numericAmount * effectiveRate;

  const isSaving = createTransaction.isPending || updateTransaction.isPending;

  async function handleSave() {
    if (!user || !fromWalletId || !toWalletId || fromWalletId === toWalletId || !numericAmount || numericAmount <= 0) {
      setError('Укажите сумму и разные кошельки — откуда и куда');
      return;
    }
    if (!sameCurrency && (!rateValue || rateValue <= 0)) {
      setError('Укажите курс обмена');
      return;
    }

    setError(null);
    const payload = {
      walletId: fromWalletId,
      transferToWalletId: toWalletId,
      type: 'transfer' as const,
      amount: numericAmount,
      exchangeRate: rateValue,
      commissionPercent: sameCurrency ? undefined : commissionValue || undefined,
      description: description || undefined,
      date,
    };

    try {
      if (transaction) {
        await updateTransaction.mutateAsync({ id: transaction.id, patch: payload });
      } else {
        await createTransaction.mutateAsync({ ...payload, createdBy: user.uid });
      }
      onClose();
    } catch (err) {
      console.error('Не удалось сохранить перевод', err);
      setError(err instanceof Error ? err.message : 'Не удалось сохранить перевод');
    }
  }

  async function handleDelete() {
    if (!transaction) return;
    setError(null);
    try {
      await deleteTransaction.mutateAsync(transaction.id);
      onClose();
    } catch (err) {
      console.error('Не удалось удалить перевод', err);
      setError(err instanceof Error ? err.message : 'Не удалось удалить перевод');
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-sheet__header">
          <button type="button" className="neo-button neo-button--icon" onClick={onClose}>
            ✕
          </button>
          <span className="modal-sheet__title">{isEditing ? 'Перевод' : 'Новый перевод'}</span>
          <span style={{ width: 36 }} />
        </div>

        <div className="transfer-modal__amount">
          <input
            className="transfer-modal__amount-input"
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9,.]/g, ''))}
            autoFocus
          />
          <span className="transfer-modal__amount-suffix">{fromWallet?.currency ?? ''}</span>
        </div>

        <div className="transfer-modal__section">
          <h3 className="section-title">Откуда</h3>
          <div className="transfer-modal__chip-row">
            {wallets.map((w) => (
              <button
                key={w.id}
                type="button"
                className={`chip${fromWalletId === w.id ? ' is-selected' : ''}`}
                style={{ ['--chip-accent' as string]: w.color ?? colorForId(w.id) }}
                onClick={() => setFromWalletId(w.id)}
              >
                {w.name}
              </button>
            ))}
          </div>
        </div>

        <div className="transfer-modal__section">
          <h3 className="section-title">Куда</h3>
          <div className="transfer-modal__chip-row">
            {wallets
              .filter((w) => w.id !== fromWalletId)
              .map((w) => (
                <button
                  key={w.id}
                  type="button"
                  className={`chip${toWalletId === w.id ? ' is-selected' : ''}`}
                  style={{ ['--chip-accent' as string]: w.color ?? colorForId(w.id) }}
                  onClick={() => setToWalletId(w.id)}
                >
                  {w.name}
                </button>
              ))}
          </div>
        </div>

        {!sameCurrency && fromWallet && toWallet && (
          <div className="transfer-modal__rate-row">
            <div className="field">
              <label className="section-title" htmlFor="transfer-rate">
                1 {fromWallet.currency} = ? {toWallet.currency}
              </label>
              <input
                id="transfer-rate"
                className="neo-input"
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={exchangeRateInput}
                onChange={(e) => setExchangeRateInput(e.target.value.replace(/[^0-9,.]/g, ''))}
              />
            </div>
            <div className="field">
              <label className="section-title" htmlFor="transfer-commission">
                Комиссия банка, %
              </label>
              <input
                id="transfer-commission"
                className="neo-input"
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={commissionInput}
                onChange={(e) => setCommissionInput(e.target.value.replace(/[^0-9,.]/g, ''))}
              />
            </div>
          </div>
        )}

        {numericAmount > 0 && toWallet && !(!sameCurrency && !rateValue) && (
          <p className="state-message">
            Зачислится: {formatAmount(creditedAmount)} {toWallet.currency}
          </p>
        )}

        <div className="field">
          <input
            className="neo-input"
            type="text"
            placeholder="Описание (необязательно)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="field">
          <input
            className="neo-input"
            type="date"
            max={today()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        {error && (
          <p className="state-message" role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          className="neo-button neo-button--accent neo-button--full"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? 'Сохранение…' : 'Перевести'}
        </button>

        {isEditing && (
          <button
            type="button"
            className="neo-button neo-button--full neo-button--danger"
            onClick={handleDelete}
            disabled={deleteTransaction.isPending}
          >
            {deleteTransaction.isPending ? 'Удаление…' : 'Удалить перевод'}
          </button>
        )}
      </div>
    </div>
  );
}
