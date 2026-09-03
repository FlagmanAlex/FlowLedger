import type { Holder, Wallet } from '@flowledger/interfaces';
import { colorForId } from '@/lib/palette';
import './WalletPicker.css';

interface WalletPickerProps {
  wallets: Wallet[];
  holders: Holder[] | undefined;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  /** Исключить кошелёк из списка — для «Куда» в переводе, чтобы нельзя
   *  было выбрать тот же кошелёк, что и «Откуда». */
  excludeId?: string;
}

function ChipRow({
  wallets,
  selectedId,
  onSelect,
}: {
  wallets: Wallet[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="wallet-picker__chip-row">
      {wallets.map((w) => (
        <button
          key={w.id}
          type="button"
          className={`chip${selectedId === w.id ? ' is-selected' : ''}`}
          style={{ ['--chip-accent' as string]: w.color ?? colorForId(w.id) }}
          onClick={() => onSelect(w.id)}
        >
          {w.name}
        </button>
      ))}
    </div>
  );
}

/** Кошельки с одинаковым названием у разных владельцев неотличимы в
 *  плоском списке чипов, а при большом числе кошельков одна горизонтальная
 *  строка становится непрокручиваемо длинной — группируем по владельцу
 *  теми же секциями, что и список кошельков на экране «Кошельки», иначе
 *  ведём себя как раньше (плоская строка), если владельцы не используются. */
export function WalletPicker({ wallets, holders, selectedId, onSelect, excludeId }: WalletPickerProps) {
  const visible = excludeId ? wallets.filter((w) => w.id !== excludeId) : wallets;
  const hasHolders = visible.some((w) => w.holderId);

  if (!hasHolders) {
    return <ChipRow wallets={visible} selectedId={selectedId} onSelect={onSelect} />;
  }

  const groups: { key: string; label: string; wallets: Wallet[] }[] = [];
  for (const h of holders ?? []) {
    const groupWallets = visible.filter((w) => w.holderId === h.id);
    if (groupWallets.length > 0) groups.push({ key: h.id, label: h.name, wallets: groupWallets });
  }
  const noHolder = visible.filter((w) => !w.holderId);
  if (noHolder.length > 0) groups.push({ key: 'none', label: 'Без владельца', wallets: noHolder });

  return (
    <div className="wallet-picker">
      {groups.map((g) => (
        <div key={g.key} className="wallet-picker__group">
          <span className="wallet-picker__group-label">{g.label}</span>
          <ChipRow wallets={g.wallets} selectedId={selectedId} onSelect={onSelect} />
        </div>
      ))}
    </div>
  );
}
