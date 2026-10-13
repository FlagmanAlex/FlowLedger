import type { Member } from '@flowledger/interfaces';
import { apiRequest } from '../api/client.js';

export async function listMembers(ownerId: string): Promise<Member[]> {
  return apiRequest<Member[]>('/members', { query: { ownerId } });
}

/** Владелец отзывает доступ участника к своей базе. */
export async function removeMember(ownerId: string, memberUid: string): Promise<void> {
  await apiRequest(`/members/${ownerId}/${memberUid}`, { method: 'DELETE' });
}

/** Участник сам покидает общий доступ — сервер заодно возвращает его на
 *  свою базу. */
export async function leaveSharedAccess(ownerId: string, memberUid: string): Promise<void> {
  await apiRequest(`/members/${ownerId}/${memberUid}`, { method: 'DELETE' });
}
