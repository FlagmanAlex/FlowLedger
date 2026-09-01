import { useState } from 'react';
import {
  useCreateHolder,
  useCreateWallet,
  useCurrencies,
  useHolders,
  useUpdateWallet,
} from '@flowledger/shared';
import type { Wallet } from '@flowledger/interfaces';
import { PALETTE } from '@/lib/palette';
import './WalletModal.css';

interface WalletModalProps {
  ownerId: string | undefined;
  wallet?: Wallet;
  onClose: () => void;
}

const WALLET_ICONS = ['💳', '💵', '💰', '🏦', '👛', '💴', '💶', '💷', '🪙', '📱'];

export function WalletModal({ ownerId, wallet, onClose }: WalletModalProps) {
  const { data: currencies } = useCurrencies(ownerId);
  const { data: holders } = useHolders(ownerId);
  const createWallet = useCreateWallet(ownerId);
  const updateWallet = useUpdateWallet();
  const createHolder = useCreateHolder(ownerId);
  const isEditing = Boolean(wallet);

  const [name, setName] = useState(wallet?.name ?? '');
  const [currency, setCurrency] = useState(wallet?.currency ?? '');
  const [holderId, setHolderId] = useState<string | undefined>(wallet?.holderId);
  const [icon, setIcon] = useState<string | undefined>(wallet?.icon);
  const [color, setColor] = useState<string | undefined>(wallet?.color);
  const [showAddHolder, setShowAddHolder] = useState(false);
  const [newHolderName, setNewHolderName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const effectiveCurrency = currency || currencies?.[0]?.code || '';

  async function handleAddHolder() {
    const trimmed = newHolderName.trim();
    if (!trimmed || !ownerId) return;
    try {
      const id = await createHolder.mutateAsync({ name: trimmed });
      setHolderId(id);
      setNewHolderName('');
      setShowAddHolder(false);
    } catch (err) {
      console.error('Не удалось добавить владельца', err);
      setError(err instanceof Error ? err.message : 'Не удалось добавить владельца');
    }
  }

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName || !ownerId || !effectiveCurrency) {
      setError('Укажите название и валюту');
      return;
    }

    setError(null);
    const patch = {
      name: trimmedName,
      currency: effectiveCurrency,
      holderId: holderId || undefined,
      icon: icon || undefined,
      color: color || undefined,
    };

    try {
      if (wallet) {
        await updateWallet.mutateAsync({ id: wallet.id, patch });
      } else {
        await createWallet.mutateAsync(patch);
      }
      onClose();
    } catch (err) {
      console.error('Не удалось сохранить кошелёк', err);
      setError(err instanceof Error ? err.message : 'Не удалось сохранить кошелёк');
    }
  }

  const isSaving = createWallet.isPending || updateWallet.isPending;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-sheet__header">
          <button type="button" className="neo-button neo-button--icon" onClick={onClose}>
            ✕
          </button>
          <span className="modal-sheet__title">{isEditing ? 'Кошелёк' : 'Новый кошелёк'}</span>
          <span style={{ width: 36 }} />
        </div>

        <div className="field">
          <input
            className="neo-input"
            type="text"
            placeholder="Название"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        <div className="wallet-modal__section">
          <h3 className="section-title">Валюта</h3>
          <select
            className="neo-input"
            value={effectiveCurrency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {(currencies ?? []).map((c) => (
              <option key={c.id} value={c.code}>
                {c.code}
              </option>
            ))}
          </select>
        </div>

        <div className="wallet-modal__section">
          <h3 className="section-title">Владелец</h3>
          <div className="wallet-modal__chip-row">
            {(holders ?? []).map((h) => (
              <button
                key={h.id}
                type="button"
                className={`chip${holderId === h.id ? ' is-selected' : ''}`}
                style={{ ['--chip-accent' as string]: h.color ?? '#7b61ff' }}
                onClick={() => setHolderId(holderId === h.id ? undefined : h.id)}
              >
                {h.name}
              </button>
            ))}
            {!showAddHolder && (
              <button
                type="button"
                className="chip wallet-modal__add-chip"
                onClick={() => setShowAddHolder(true)}
              >
                + Добавить
              </button>
            )}
          </div>
          {showAddHolder && (
            <div className="wallet-modal__add-holder">
              <input
                className="neo-input"
                type="text"
                placeholder="Например, Жена"
                value={newHolderName}
                onChange={(e) => setNewHolderName(e.target.value)}
                autoFocus
              />
              <button
                type="button"
                className="neo-button neo-button--sm"
                onClick={handleAddHolder}
                disabled={createHolder.isPending}
              >
                Добавить
              </button>
            </div>
          )}
        </div>

        <div className="wallet-modal__section">
          <h3 className="section-title">Значок</h3>
          <div className="wallet-modal__icon-grid">
            {WALLET_ICONS.map((i) => (
              <button
                key={i}
                type="button"
                className={`wallet-modal__icon-cell${icon === i ? ' is-selected' : ''}`}
                onClick={() => setIcon(icon === i ? undefined : i)}
              >
                {i}
              </button>
            ))}
          </div>
        </div>

        <div className="wallet-modal__section">
          <h3 className="section-title">Цвет</h3>
          <div className="wallet-modal__color-row">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                className={`wallet-modal__color-swatch${color === c ? ' is-selected' : ''}`}
                style={{ background: c }}
                aria-label={c}
                onClick={() => setColor(color === c ? undefined : c)}
              />
            ))}
          </div>
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
