import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Wallet } from '@flowledger/interfaces';
import { archiveWallet, createWallet, listWallets, updateWallet } from '../repositories/wallets.repo.js';

export function useWallets(userId: string | undefined) {
  return useQuery({
    queryKey: ['wallets', userId],
    queryFn: () => listWallets(userId!),
    enabled: Boolean(userId),
  });
}

export function useCreateWallet(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Wallet, 'id' | 'userId' | 'balance' | 'archived' | 'createdAt'>) =>
      createWallet(userId!, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wallets'] }),
  });
}

export function useUpdateWallet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Wallet> }) => updateWallet(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wallets'] }),
  });
}

export function useArchiveWallet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveWallet(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wallets'] }),
  });
}
