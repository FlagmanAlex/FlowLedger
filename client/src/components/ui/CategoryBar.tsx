import { formatAmount } from '@/lib/format';

interface CategoryBarProps {
  name: string;
  amount: number;
  currency: string;
  percent: number;
  color: string;
}

export function CategoryBar({ name, amount, currency, percent, color }: CategoryBarProps) {
  return (
    <div className="category-bar">
      <div className="category-bar__line">
        <span>{name}</span>
        <span>
          {formatAmount(amount)} {currency}
        </span>
      </div>
      <div className="progress-track">
        <div
          className="progress-fill"
          style={{ width: `${Math.min(100, percent)}%`, ['--fill-color' as string]: color }}
        />
      </div>
    </div>
  );
}
