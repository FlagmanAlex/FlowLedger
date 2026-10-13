import type { Currency } from '@flowledger/interfaces';
import { apiRequest } from '../api/client.js';

/** Список валют базы. У новой базы сервер сам заводит стандартный набор
 *  (RUB, USD, UAH) при первом обращении. */
export async function listCurrencies(userId: string): Promise<Currency[]> {
  return apiRequest<Currency[]>('/currencies', { query: { ownerId: userId } });
}

export async function createCurrency(
  userId: string,
  input: Omit<Currency, 'id' | 'userId' | 'createdAt'>,
): Promise<string> {
  const { id } = await apiRequest<{ id: string }>('/currencies', {
    method: 'POST',
    body: { ...input, ownerId: userId },
  });
  return id;
}
