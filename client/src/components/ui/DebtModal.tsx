import { useState } from 'react';
import { useCreateDebt, useUpdateDebt, useUpdateDebtOpening, type UseAuthResult } from '@flowledger/shared';
import type { Debt, DebtCounterpartyType, DebtDirection, Holder, Transaction, Wallet } from '@flowledger/interfaces';
import { WalletPicker } from '@/components/ui/WalletPicker';
import './WalletModal.css';

interface DebtModalProps {
  user: UseAuthResult['user'];
  ownerId: string | undefined;
  wallets: Wallet[];
  holders: Holder[] | undefined;
  debt?: Debt;
  /** Открывающая операция долга — обязательна при редактировании (см.
   *  Debts.tsx: модалка не монтируется, пока она не загружена), не
   *  используется при создании. Хранит сумму/кошелёк/дату/описание,
   *  которых на самом Debt нет. */
  openingTransaction?: Transaction;
  onClose: () => void;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Создание долга заводит и открывающую операцию (debt_lend/debt_borrow) в
 * общем журнале. Редактирование правит и карточку долга (контрагент/тип/
 * срок — updateDebt), и саму открывающую операцию (сумма/кошелёк/дата/
 * описание — updateDebtOpening, та же атомарная логика баланса, что и у
 * обычных операций). Направление (дал/взял) после создания не меняется —
 * это перевернуло бы знак движения кошелька у уже сделанных погашений
 * (см. debts.repo.ts); для такой правки проще удалить долг и завести
 * заново.
 */
export function DebtModal({ user, ownerId, wallets, holders, debt, openingTransaction, onClose }: DebtModalProps) {
  const createDebt = useCreateDebt(ownerId);
  const updateDebt = useUpdateDebt();
  const updateDebtOpening = useUpdateDebtOpening();
  const isEditing = Boolean(debt);

  const [direction, setDirection] = useState<DebtDirection>(debt?.direction ?? 'lent');
  const [counterpartyType, setCounterpartyType] = useState<DebtCounterpartyType>(
    debt?.counterpartyType ?? 'person',
  );
  const [counterpartyName, setCounterpartyName] = useState(debt?.counterpartyName ?? '');
  const [walletId, setWalletId] = useState<string | undefined>(
    debt?.walletId ?? openingTransaction?.walletId ?? wallets[0]?.id,
  );
  const [principal, setPrincipal] = useState(openingTransaction ? String(openingTransaction.amount) : '');
  const [dueDate, setDueDate] = useState(debt?.dueDate ?? '');
  const [description, setDescription] = useState(openingTransaction?.description ?? '');
  const [date, setDate] = useState(openingTransaction?.date ?? today());
  const [error, setError] = useState<string | null>(null);

  const isSaving = createDebt.isPending || updateDebt.isPending || updateDebtOpening.isPending;

  async function handleSave() {
    const trimmedName = counterpartyName.trim();
    if (!trimmedName) {
      setError('Укажите контрагента');
      return;
    }

    const numericPrincipal = Number(principal.replace(',', '.'));
    if (!walletId || !numericPrincipal || numericPrincipal <= 0) {
      setError('Укажите кошелёк и сумму');
      return;
    }

    if (isEditing) {
      setError(null);
      try {
        await Promise.all([
          updateDebt.mutateAsync({
            id: debt!.id,
            patch: { counterpartyName: trimmedName, counterpartyType, dueDate: dueDate || undefined },
          }),
          updateDebtOpening.mutateAsync({
            debt: debt!,
            openingTransactionId: openingTransaction!.id,
            input: {
              walletId,
              principal: numericPrincipal,
              date,
              description: description || undefined,
            },
          }),
        ]);
        onClose();
      } catch (err) {
        console.error('Не удалось сохранить долг', err);
        setError(err instanceof Error ? err.message : 'Не удалось сохранить долг');
      }
      return;
    }

    if (!user || !ownerId) {
      setError('Укажите контрагента, кошелёк и сумму');
      return;
    }

    setError(null);
    try {
      await createDebt.mutateAsync({
        input: {
          walletId,
          direction,
          counterpartyType,
          counterpartyName: trimmedName,
          principal: numericPrincipal,
          dueDate: dueDate || undefined,
          date,
          description: description || undefined,
        },
        createdBy: user.uid,
      });
      onClose();
    } catch (err) {
      console.error('Не удалось завести долг', err);
      setError(err instanceof Error ? err.message : 'Не удалось завести долг');
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-sheet__header">
          <button type="button" className="neo-button neo-button--icon" onClick={onClose}>
            ✕
          </button>
          <span className="modal-sheet__title">{isEditing ? 'Долг' : 'Новый долг'}</span>
          <span style={{ width: 44 }} />
        </div>

        {!isEditing && (
          <div className="segmented">
            <button
              type="button"
              className={`segmented__item${direction === 'lent' ? ' is-active' : ''}`}
              onClick={() => setDirection('lent')}
            >
              Дал в долг
            </button>
            <button
              type="button"
              className={`segmented__item${direction === 'borrowed' ? ' is-active' : ''}`}
              onClick={() => setDirection('borrowed')}
            >
              Взял в долг
            </button>
          </div>
        )}

        <div className="wallet-modal__section">
          <h3 className="section-title">Контрагент</h3>
          <div className="wallet-modal__chip-row">
            <button
              type="button"
              className={`chip${counterpartyType === 'person' ? ' is-selected' : ''}`}
              onClick={() => setCounterpartyType('person')}
            >
              🙂 Частное лицо
            </button>
            <button
              type="button"
              className={`chip${counterpartyType === 'bank' ? ' is-selected' : ''}`}
              onClick={() => setCounterpartyType('bank')}
            >
              🏦 Банк
            </button>
          </div>
        </div>

        <div className="field">
          <input
            className="neo-input"
            type="text"
            placeholder={counterpartyType === 'bank' ? 'Название банка' : 'Имя'}
            value={counterpartyName}
            onChange={(e) => setCounterpartyName(e.target.value)}
            autoFocus
          />
        </div>

        <div className="wallet-modal__section">
          <h3 className="section-title">Кошелёк</h3>
          <WalletPicker wallets={wallets} holders={holders} selectedId={walletId} onSelect={setWalletId} />
        </div>

        <div className="field">
          <input
            className="neo-input"
            type="text"
            inputMode="decimal"
            placeholder="Сумма"
            value={principal}
            onChange={(e) => setPrincipal(e.target.value.replace(/[^0-9,.]/g, ''))}
          />
        </div>

        <div className="field">
          <label className="section-title" htmlFor="debt-due-date">
            Срок возврата (необязательно)
          </label>
          <input
            id="debt-due-date"
            className="neo-input"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
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
          {isSaving ? 'Сохранение…' : isEditing ? 'Сохранить' : 'Добавить'}
        </button>
      </div>
    </div>
  );
}
