import type { Category } from '@flowledger/interfaces';
import { apiRequest } from '../api/client.js';

/** Категории базы — уже отсортированы сервером (sortOrder, а без него —
 *  по времени создания). */
export async function listCategories(userId: string): Promise<Category[]> {
  return apiRequest<Category[]>('/categories', { query: { ownerId: userId } });
}

export async function createCategory(
  userId: string,
  input: Omit<Category, 'id' | 'userId' | 'createdAt' | 'sortOrder'>,
): Promise<string> {
  const { id } = await apiRequest<{ id: string }>('/categories', {
    method: 'POST',
    body: { ...input, ownerId: userId },
  });
  return id;
}

export async function updateCategory(id: string, patch: Partial<Category>): Promise<void> {
  await apiRequest(`/categories/${id}`, { method: 'PATCH', body: patch });
}

export async function deleteCategory(id: string): Promise<void> {
  await apiRequest(`/categories/${id}`, { method: 'DELETE' });
}
