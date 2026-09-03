export type CategoryType = 'income' | 'expense';

export interface Category {
  id: string;
  userId: string;
  name: string;
  type: CategoryType;
  icon?: string;
  color?: string;
  parentId?: string | null;
  /** Порядок в списке — задаётся вручную перетаскиванием (long-press),
   *  без него сортировка идёт по createdAt (порядок создания). */
  sortOrder?: number;
  createdAt: string;
}
