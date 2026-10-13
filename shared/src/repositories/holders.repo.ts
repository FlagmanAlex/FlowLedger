import type { Holder } from '@flowledger/interfaces';
import { apiRequest } from '../api/client.js';

export async function listHolders(userId: string): Promise<Holder[]> {
  return apiRequest<Holder[]>('/holders', { query: { ownerId: userId } });
}

export async function createHolder(
  userId: string,
  input: Omit<Holder, 'id' | 'userId' | 'createdAt'>,
): Promise<string> {
  const { id } = await apiRequest<{ id: string }>('/holders', {
    method: 'POST',
    body: { ...input, ownerId: userId },
  });
  return id;
}
