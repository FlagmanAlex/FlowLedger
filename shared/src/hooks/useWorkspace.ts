import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  acceptWorkspaceInvite,
  getWorkspaceConfig,
  inviteMemberByEmail,
  removeMember,
} from '../repositories/workspace.repo.js';

export function useWorkspace(enabled: boolean) {
  return useQuery({
    queryKey: ['workspace'],
    queryFn: getWorkspaceConfig,
    enabled,
  });
}

export function useInviteMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => inviteMemberByEmail(email),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspace'] }),
  });
}

export function useAcceptWorkspaceInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (uid: string) => acceptWorkspaceInvite(uid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspace'] }),
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (uid: string) => removeMember(uid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspace'] }),
  });
}
