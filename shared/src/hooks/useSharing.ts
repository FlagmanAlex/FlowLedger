import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { doc, getDoc } from 'firebase/firestore';
import type { AuthUser, Invite } from '@flowledger/interfaces';
import { getUser, setActiveOwner } from '../repositories/users.repo.js';
import {
  acceptInvite,
  createInvite,
  getInvite,
  listPendingInvites,
  revokeInvite,
} from '../repositories/invites.repo.js';
import { leaveSharedAccess, listMembers, removeMember } from '../repositories/members.repo.js';
import { membersCollection } from '../repositories/collections.js';

export function useUserDoc(uid: string | undefined) {
  return useQuery({
    queryKey: ['userDoc', uid],
    queryFn: () => getUser(uid!),
    enabled: Boolean(uid),
  });
}

/**
 * Чью базу сейчас использует вошедший пользователь: свою (по умолчанию) или
 * базу другого владельца, к которой получил доступ по приглашению
 * (`users/{uid}.activeOwnerId`). Если запись о членстве у владельца исчезла
 * (доступ отозван), молча возвращает пользователя на его собственную базу —
 * без этого он бы упирался в permission-denied вместо работы со своими
 * данными.
 */
export function useOwnerId(user: AuthUser | null): {
  ownerId: string | undefined;
  isSharedAccess: boolean;
  isLoading: boolean;
} {
  const uid = user?.uid;
  const userDocQuery = useUserDoc(uid);
  const activeOwnerId = userDocQuery.data?.activeOwnerId;

  const membershipQuery = useQuery({
    queryKey: ['membership', activeOwnerId, uid],
    queryFn: async () => {
      const snap = await getDoc(doc(membersCollection(activeOwnerId!), uid!));
      if (!snap.exists()) {
        await setActiveOwner(uid!, undefined);
        return false;
      }
      return true;
    },
    enabled: Boolean(activeOwnerId && uid),
  });

  const isSharedAccess = Boolean(activeOwnerId) && membershipQuery.data !== false;
  const ownerId = isSharedAccess ? activeOwnerId : uid;

  return {
    ownerId,
    isSharedAccess,
    isLoading: userDocQuery.isLoading || (Boolean(activeOwnerId) && membershipQuery.isLoading),
  };
}

export function useCreateInvite(ownerId: string | undefined, ownerDisplayName: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => createInvite(ownerId!, ownerDisplayName),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invites', ownerId] }),
  });
}

export function usePendingInvites(ownerId: string | undefined) {
  return useQuery({
    queryKey: ['invites', ownerId],
    queryFn: () => listPendingInvites(ownerId!),
    enabled: Boolean(ownerId),
  });
}

export function useRevokeInvite(ownerId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => revokeInvite(inviteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invites', ownerId] }),
  });
}

export function useInvite(inviteId: string | undefined) {
  return useQuery({
    queryKey: ['invite', inviteId],
    queryFn: () => getInvite(inviteId!),
    enabled: Boolean(inviteId),
  });
}

export function useAcceptInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ invite, acceptor }: { invite: Invite; acceptor: AuthUser }) =>
      acceptInvite(invite, acceptor),
    onSuccess: (_, { acceptor }) => {
      queryClient.invalidateQueries({ queryKey: ['userDoc', acceptor.uid] });
      queryClient.invalidateQueries({ queryKey: ['membership'] });
    },
  });
}

export function useMembers(ownerId: string | undefined) {
  return useQuery({
    queryKey: ['members', ownerId],
    queryFn: () => listMembers(ownerId!),
    enabled: Boolean(ownerId),
  });
}

export function useRemoveMember(ownerId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberUid: string) => removeMember(ownerId!, memberUid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members', ownerId] }),
  });
}

export function useLeaveSharedAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ownerId, memberUid }: { ownerId: string; memberUid: string }) =>
      leaveSharedAccess(ownerId, memberUid),
    onSuccess: (_, { memberUid }) => {
      queryClient.invalidateQueries({ queryKey: ['userDoc', memberUid] });
      queryClient.invalidateQueries({ queryKey: ['membership'] });
    },
  });
}

/** Ссылка-приглашение — строится от текущего origin, чтобы работать
 *  одинаково в dev и в проде без отдельного конфига. `basePath` — путь,
 *  под которым задеплоен сам клиент (например, `/flowledger/` при
 *  деплое на общий домен с другим проектом, см. `vite.config.ts`); без
 *  него ссылка не совпадала бы с реальным маршрутом приложения и вела
 *  бы на 404. */
export function useInviteLink(inviteId: string | undefined, basePath = ''): string | undefined {
  return useMemo(() => {
    if (!inviteId || typeof window === 'undefined') return undefined;
    const normalizedBase = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
    return `${window.location.origin}${normalizedBase}/invite/${inviteId}`;
  }, [inviteId, basePath]);
}
