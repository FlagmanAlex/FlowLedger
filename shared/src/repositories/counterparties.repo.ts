import type { Counterparty } from '@flowledger/interfaces';
import { apiRequest } from '../api/client.js';

export async function listCounterparties(userId: string): Promise<Counterparty[]> {
  return apiRequest<Counterparty[]>('/counterparties', { query: { ownerId: userId } });
}

export async function createCounterparty(
  userId: string,
  input: Omit<Counterparty, 'id' | 'userId' | 'createdAt'>,
): Promise<string> {
  const { id } = await apiRequest<{ id: string }>('/counterparties', {
    method: 'POST',
    body: { ...input, ownerId: userId },
  });
  return id;
}
