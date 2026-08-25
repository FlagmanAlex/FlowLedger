export type CategoryType = 'income' | 'expense';

export interface Category {
  id: string;
  tenantId: string;
  name: string;
  type: CategoryType;
  icon?: string;
  color?: string;
  parentId?: string | null;
  createdAt: string;
}
