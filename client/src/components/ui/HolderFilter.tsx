import type { Holder, Wallet } from '@flowledger/interfaces';
import type { HolderFilterValue } from '@/lib/holderFilter';

interface HolderFilterProps {
  holders: Holder[];
  wallets: Wallet[];
  value: HolderFilterValue;
  onChange: (value: HolderFilterValue) => void;
}

/** Фильтр по держателю кошелька («Бизнес»/«Личное» и т.п., см.
 *  Holder) — скрывается сам, если ни у одного кошелька держатель не
 *  задан (нечего фильтровать). */
export function HolderFilter({ holders, wallets, value, onChange }: HolderFilterProps) {
  const hasHolderAssignments = wallets.some((w) => w.holderId);
  if (!hasHolderAssignments) return null;
  const hasUnassigned = wallets.some((w) => !w.holderId);

  return (
    <div className="chip-row">
      <button
        type="button"
        className={`chip${value === 'all' ? ' is-selected' : ''}`}
        onClick={() => onChange('all')}
      >
        Все
      </button>
      {holders.map((h) => (
        <button
          key={h.id}
          type="button"
          className={`chip${value === h.id ? ' is-selected' : ''}`}
          style={{ ['--chip-accent' as string]: h.color ?? 'var(--accent)' }}
          onClick={() => onChange(h.id)}
        >
          {h.name}
        </button>
      ))}
      {hasUnassigned && (
        <button
          type="button"
          className={`chip${value === 'none' ? ' is-selected' : ''}`}
          onClick={() => onChange('none')}
        >
          Без владельца
        </button>
      )}
    </div>
  );
}
