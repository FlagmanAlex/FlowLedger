import type { Wallet } from '@flowledger/interfaces';

/** Значение фильтра по держателю кошелька: id держателя, 'all' (без
 *  фильтра) или 'none' (кошельки без владельца). */
export type HolderFilterValue = 'all' | 'none' | string;

/** id кошельков, соответствующих выбранному значению фильтра — undefined
 *  для 'all' (не фильтровать), а не пустой массив, чтобы отличать
 *  «фильтр выключен» от «держателю не принадлежит ни один кошелёк». */
export function walletIdsForHolderFilter(
  wallets: Wallet[],
  value: HolderFilterValue,
): string[] | undefined {
  if (value === 'all') return undefined;
  if (value === 'none') return wallets.filter((w) => !w.holderId).map((w) => w.id);
  return wallets.filter((w) => w.holderId === value).map((w) => w.id);
}
