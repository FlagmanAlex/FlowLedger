import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Wallet } from '@flowledger/interfaces';
import { createWallet, listWallets, updateWallet, archiveWallet } from '../repositories/wallets.repo.js';

export function useWallets(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['wallets', tenantId],
    queryFn: () => listWallets(tenantId!),
    enabled: Boolean(tenantId),
  });
}

export function useCreateWallet(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Wallet, 'id' | 'balance' | 'archived' | 'createdAt'>) =>
      createWallet(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wallets', tenantId] }),
  });
}

export function useUpdateWallet(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Wallet> }) => updateWallet(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wallets', tenantId] }),
  });
}

export function useArchiveWallet(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveWallet(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wallets', tenantId] }),
  });
}
