import type { User } from '@flowledger/interfaces';
import { ApiError, apiRequest, getCurrentUser } from '../api/client.js';

/** Профиль пользователя: свой (через /me — сервер заодно возвращает на свою
 *  базу, если доступ к чужой отозван) или владельца базы, где ты участник. */
export async function getUser(uid: string): Promise<User | null> {
  try {
    return await apiRequest<User>(uid === getCurrentUser()?.uid ? '/me' : `/users/${uid}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** Переключает пользователя на базу другого владельца или обратно на свою
 *  (`ownerId === undefined`). Сервер разрешает только базы, где он участник. */
export async function setActiveOwner(_uid: string, ownerId: string | undefined): Promise<void> {
  await apiRequest('/me/active-owner', { method: 'PUT', body: { ownerId: ownerId ?? null } });
}
