import { useState } from 'react';
import { useRepayDebt, type UseAuthResult } from '@flowledger/shared';
import type { Debt } from '@flowledger/interfaces';
import { formatAmount } from '@/lib/format';

interface RepayDebtModalProps {
  user: UseAuthResult['user'];
  ownerId: string | undefined;
  debt: Debt;
  currency: string;
  onClose: () => void;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function RepayDebtModal({ user, ownerId, debt, currency, onClose }: RepayDebtModalProps) {
  const repayDebt = useRepayDebt(ownerId);
  const [amount, setAmount] = useState(String(debt.remainingAmount));
  const [date, setDate] = useState(today());
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const numericAmount = Number(amount.replace(',', '.')) || 0;

  async function handleSave() {
    if (!user || !numericAmount || numericAmount <= 0 || numericAmount > debt.remainingAmount) {
      setError(`Укажите сумму от 0 до ${formatAmount(debt.remainingAmount)}`);
      return;
    }
    setError(null);
    try {
      await repayDebt.mutateAsync({
        debt,
        input: { amount: numericAmount, date, description: description || undefined },
        createdBy: user.uid,
      });
      onClose();
    } catch (err) {
      console.error('Не удалось зафиксировать погашение', err);
      setError(err instanceof Error ? err.message : 'Не удалось зафиксировать погашение');
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-sheet__header">
          <button type="button" className="neo-button neo-button--icon" onClick={onClose}>
            ✕
          </button>
          <span className="modal-sheet__title">Погашение долга</span>
          <span style={{ width: 44 }} />
        </div>

        <p className="state-message">
          {debt.direction === 'lent' ? 'Возврат от' : 'Платёж для'} «{debt.counterpartyName}» — остаток{' '}
          {formatAmount(debt.remainingAmount)} {currency}
        </p>

        <div className="field">
          <input
            className="neo-input"
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9,.]/g, ''))}
            autoFocus
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

        <div className="field">
          <input
            className="neo-input"
            type="text"
            placeholder="Описание (необязательно)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
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
          disabled={repayDebt.isPending}
        >
          {repayDebt.isPending ? 'Сохранение…' : 'Погасить'}
        </button>
      </div>
    </div>
  );
}
