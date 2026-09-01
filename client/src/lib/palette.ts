/** Палитра для кошельков/категорий без явного `color` — те же акценты, что в tokens.css. */
export const PALETTE = ['#7B61FF', '#2FE6B8', '#FF5C7A', '#FFB454', '#FFC857', '#FF7BD1', '#8891B0'];

export function colorForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}
