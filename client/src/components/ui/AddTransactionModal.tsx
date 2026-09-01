import { useEffect, useState } from 'react';
import {
  useCreateTransaction,
  useDeleteTransaction,
  useUpdateTransaction,
  type UseAuthResult,
} from '@flowledger/shared';
import type { Category, Transaction, TransactionType, Wallet } from '@flowledger/interfaces';
import { IconCircle } from '@/components/ui/IconCircle';
import { colorForId } from '@/lib/palette';
import './AddTransactionModal.css';

interface AddTransactionModalProps {
  user: UseAuthResult['user'];
  ownerId: string | undefined;
  wallets: Wallet[];
  categories: Category[];
  defaultType: TransactionType;
  transaction?: Transaction;
  onClose: () => void;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AddTransactionModal({
  user,
  ownerId,
  wallets,
  categories,
  defaultType,
  transaction,
  onClose,
}: AddTransactionModalProps) {
  const createTransaction = useCreateTransaction(ownerId);
  const updateTransaction = useUpdateTransaction();
  const deleteTransaction = useDeleteTransaction();
  const isEditing = Boolean(transaction);

  const [type, setType] = useState<TransactionType>(transaction?.type ?? defaultType);
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : '');
  const [walletId, setWalletId] = useState<string | undefined>(transaction?.walletId ?? wallets[0]?.id);
  const [categoryId, setCategoryId] = useState<string | undefined>(transaction?.categoryId);
  const [description, setDescription] = useState(transaction?.description ?? '');
  const [date, setDate] = useState(transaction?.date ?? today());
  const [error, setError] = useState<string | null>(null);

  const categoriesForType = categories.filter((c) => c.type === type);

  useEffect(() => {
    if (!categoriesForType.some((c) => c.id === categoryId)) {
      setCategoryId(categoriesForType[0]?.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, categories]);

  async function handleSave() {
    const numericAmount = Number(amount.replace(',', '.'));
    if (!user || !walletId || !categoryId || !numericAmount || numericAmount <= 0) {
      setError('Укажите сумму, кошелёк и категорию');
      return;
    }

    if (transaction) {
      await updateTransaction.mutateAsync({
        id: transaction.id,
        patch: {
          walletId,
          categoryId,
          type,
          amount: numericAmount,
          description: description || undefined,
          date,
        },
      });
    } else {
      await createTransaction.mutateAsync({
        walletId,
        categoryId,
        type,
        amount: numericAmount,
        description: description || undefined,
        date,
        createdBy: user.uid,
      });
    }
    onClose();
  }

  async function handleDelete() {
    if (!transaction) return;
    await deleteTransaction.mutateAsync(transaction.id);
    onClose();
  }

  const isSaving = createTransaction.isPending || updateTransaction.isPending;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-sheet__header">
          <button type="button" className="neo-button neo-button--icon" onClick={onClose}>
            ✕
          </button>
          <span className="modal-sheet__title">{isEditing ? 'Операция' : 'Новая операция'}</span>
          <span style={{ width: 36 }} />
        </div>

        <div className="segmented add-tx__type">
          <button
            type="button"
            className={`segmented__item${type === 'expense' ? ' is-active' : ''}`}
            onClick={() => setType('expense')}
          >
            Расход
          </button>
          <button
            type="button"
            className={`segmented__item${type === 'income' ? ' is-active' : ''}`}
            onClick={() => setType('income')}
          >
            Доход
          </button>
        </div>

        <div className={`add-tx__amount ${type === 'expense' ? 'amount-negative' : 'amount-positive'}`}>
          <input
            className="add-tx__amount-input"
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9,.]/g, ''))}
            autoFocus
          />
          <span className="add-tx__amount-suffix">₽</span>
        </div>

        <div className="add-tx__section">
          <h3 className="section-title">Кошелёк</h3>
          <div className="add-tx__chip-row">
            {wallets.map((w) => (
              <button
                key={w.id}
                type="button"
                className={`chip${walletId === w.id ? ' is-selected' : ''}`}
                style={{ ['--chip-accent' as string]: w.color ?? colorForId(w.id) }}
                onClick={() => setWalletId(w.id)}
              >
                {w.name}
              </button>
            ))}
          </div>
        </div>

        <div className="add-tx__section">
          <h3 className="section-title">Категория</h3>
          <div className="add-tx__category-grid">
            {categoriesForType.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`add-tx__category-cell${categoryId === c.id ? ' is-selected' : ''}`}
                onClick={() => setCategoryId(c.id)}
              >
                <IconCircle label={c.name} color={c.color ?? colorForId(c.id)} size={32} fontSize={13} />
                <span>{c.name}</span>
              </button>
            ))}
            {categoriesForType.length === 0 && (
              <p className="state-message">Сначала добавьте категорию</p>
            )}
          </div>
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
          Сохранить
        </button>

        {isEditing && (
          <button
            type="button"
            className="neo-button neo-button--full add-tx__delete"
            onClick={handleDelete}
            disabled={deleteTransaction.isPending}
          >
            Удалить операцию
          </button>
        )}
      </div>
    </div>
  );
}
