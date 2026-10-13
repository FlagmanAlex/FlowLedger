import type { Wallet } from '@flowledger/interfaces';
import { apiRequest } from '../api/client.js';

/** Кошельки базы — уже отсортированы сервером (sortOrder, а без него — по
 *  времени создания). */
export async function listWallets(userId: string): Promise<Wallet[]> {
  return apiRequest<Wallet[]>('/wallets', { query: { ownerId: userId } });
}

/** Новый кошелёк — с нулевым балансом; баланс дальше меняют только операции. */
export async function createWallet(
  userId: string,
  input: Omit<Wallet, 'id' | 'userId' | 'balance' | 'archived' | 'createdAt' | 'sortOrder'>,
): Promise<string> {
  const { id } = await apiRequest<{ id: string }>('/wallets', {
    method: 'POST',
    body: { ...input, ownerId: userId },
  });
  return id;
}

export async function updateWallet(id: string, patch: Partial<Wallet>): Promise<void> {
  await apiRequest(`/wallets/${id}`, { method: 'PATCH', body: patch });
}

export async function archiveWallet(id: string): Promise<void> {
  await updateWallet(id, { archived: true });
}

export async function deleteWallet(id: string): Promise<void> {
  await apiRequest(`/wallets/${id}`, { method: 'DELETE' });
}
