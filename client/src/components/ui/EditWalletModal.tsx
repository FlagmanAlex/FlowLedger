import { useState } from 'react';
import { useUpdateWallet } from '@flowledger/shared';
import type { Wallet } from '@flowledger/interfaces';

interface EditWalletModalProps {
  wallet: Wallet;
  onClose: () => void;
}

export function EditWalletModal({ wallet, onClose }: EditWalletModalProps) {
  const updateWallet = useUpdateWallet();
  const [name, setName] = useState(wallet.name);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Укажите название');
      return;
    }

    setError(null);
    try {
      await updateWallet.mutateAsync({ id: wallet.id, patch: { name: trimmed } });
      onClose();
    } catch (err) {
      console.error('Не удалось сохранить кошелёк', err);
      setError(err instanceof Error ? err.message : 'Не удалось сохранить кошелёк');
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-sheet__header">
          <button type="button" className="neo-button neo-button--icon" onClick={onClose}>
            ✕
          </button>
          <span className="modal-sheet__title">Кошелёк</span>
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

        {error && (
          <p className="state-message" role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          className="neo-button neo-button--accent neo-button--full"
          onClick={handleSave}
          disabled={updateWallet.isPending}
        >
          {updateWallet.isPending ? 'Сохранение…' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
}
