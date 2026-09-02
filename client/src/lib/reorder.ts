interface Orderable {
  id: string;
  sortOrder?: number;
  createdAt: string;
}

function effectiveOrder(item: Orderable): number {
  return item.sortOrder ?? new Date(item.createdAt).getTime();
}

/** Новый sortOrder для элемента, перемещённого между beforeId и afterId
 *  (id соседей на новом месте, null на краю списка) — среднее значение
 *  между соседями, либо смещение на 1000 от единственного соседа. Один
 *  Firestore-запрос на перетаскивание — соседей переписывать не нужно. */
export function nextSortOrder<T extends Orderable>(
  items: T[],
  beforeId: string | null,
  afterId: string | null,
): number {
  const before = beforeId ? items.find((i) => i.id === beforeId) : undefined;
  const after = afterId ? items.find((i) => i.id === afterId) : undefined;

  if (before && after) return (effectiveOrder(before) + effectiveOrder(after)) / 2;
  if (before) return effectiveOrder(before) + 1000;
  if (after) return effectiveOrder(after) - 1000;
  return Date.now();
}
