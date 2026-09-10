import { IconCircle } from './IconCircle';
import { formatAmount } from '@/lib/format';

interface CategoryBarProps {
  name: string;
  amount: number;
  currency: string;
  percent: number;
  color: string;
  icon?: string;
}

export function CategoryBar({ name, amount, currency, percent, color, icon }: CategoryBarProps) {
  return (
    <div className="category-bar">
      <IconCircle label={name} icon={icon} color={color} size={28} fontSize={12} />
      <div className="category-bar__body">
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
    </div>
  );
}
