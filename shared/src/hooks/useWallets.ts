import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Wallet } from '@flowledger/interfaces';
import { createWallet, listWallets, updateWallet, archiveWallet } from '../repositories/wallets.repo.js';

export function useWallets(enabled: boolean) {
  return useQuery({
    queryKey: ['wallets'],
    queryFn: listWallets,
    enabled,
  });
}

export function useCreateWallet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Wallet, 'id' | 'balance' | 'archived' | 'createdAt'>) =>
      createWallet(input),
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
