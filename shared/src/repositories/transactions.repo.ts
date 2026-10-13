import type { Transaction } from '@flowledger/interfaces';
import { apiRequest } from '../api/client.js';

export interface TransactionFilters {
  /** История кошелька: и списания с него, и приход переводом с другого. */
  walletId?: string;
  categoryId?: string;
  type?: Transaction['type'];
  /** История операций одного долга (см. Debts). */
  debtId?: string;
  /** Включительно, формат YYYY-MM-DD — фильтр по месяцу и т.п. */
  dateFrom?: string;
  /** Исключительно (< dateTo), формат YYYY-MM-DD. */
  dateTo?: string;
  limit?: number;
}

/** Операции базы, новые сверху (дата, затем время создания). */
export async function listTransactions(
  userId: string,
  filters: TransactionFilters = {},
): Promise<Transaction[]> {
  return apiRequest<Transaction[]>('/transactions', {
    query: { ownerId: userId, ...filters },
  });
}

/**
 * Балансы кошельков (и остатки долгов для debt_*-операций) пересчитывает
 * сервер в той же транзакции Mongo, что и саму операцию. createdBy сервер
 * берёт из сессии — переданное значение игнорируется.
 */
export async function createTransaction(
  userId: string,
  input: Omit<Transaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const { id } = await apiRequest<{ id: string }>('/transactions', {
    method: 'POST',
    body: { ...input, ownerId: userId },
  });
  return id;
}

export async function updateTransaction(id: string, patch: Partial<Transaction>): Promise<void> {
  await apiRequest(`/transactions/${id}`, { method: 'PATCH', body: patch });
}

export async function deleteTransaction(id: string): Promise<void> {
  await apiRequest(`/transactions/${id}`, { method: 'DELETE' });
}
