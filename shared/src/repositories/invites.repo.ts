import type { AuthUser, Invite } from '@flowledger/interfaces';
import { ApiError, apiRequest } from '../api/client.js';

/** Создаёт приглашение в общий доступ к своей базе; неугадываемый id — это
 *  и есть секрет ссылки `/invite/{id}`. Срок — 7 дней (задаёт сервер). */
export async function createInvite(ownerId: string, ownerDisplayName: string): Promise<string> {
  const { id } = await apiRequest<{ id: string }>('/invites', {
    method: 'POST',
    body: { ownerId, ownerDisplayName },
  });
  return id;
}

export async function getInvite(inviteId: string): Promise<Invite | null> {
  try {
    return await apiRequest<Invite>(`/invites/${inviteId}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function listPendingInvites(ownerId: string): Promise<Invite[]> {
  return apiRequest<Invite[]>('/invites', { query: { ownerId } });
}

export async function revokeInvite(inviteId: string): Promise<void> {
  await apiRequest(`/invites/${inviteId}/revoke`, { method: 'POST' });
}

/** Принятие приглашения: сервер одной транзакцией добавляет принявшего в
 *  участники, помечает приглашение принятым и переключает его активную базу
 *  на базу владельца. Данные участника сервер берёт из профиля. */
export async function acceptInvite(invite: Invite, _acceptor: AuthUser): Promise<void> {
  await apiRequest(`/invites/${invite.id}/accept`, { method: 'POST' });
}
