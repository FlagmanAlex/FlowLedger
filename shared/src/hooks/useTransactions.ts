import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Transaction } from '@flowledger/interfaces';
import {
  createTransaction,
  deleteTransaction,
  listTransactions,
  type TransactionFilters,
  updateTransaction,
} from '../repositories/transactions.repo.js';

export function useTransactions(tenantId: string | undefined, filters: TransactionFilters = {}) {
  return useQuery({
    queryKey: ['transactions', tenantId, filters],
    queryFn: () => listTransactions(tenantId!, filters),
    enabled: Boolean(tenantId),
  });
}

export function useCreateTransaction(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) =>
      createTransaction(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['wallets', tenantId] });
    },
  });
}

export function useUpdateTransaction(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Transaction> }) =>
      updateTransaction(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['wallets', tenantId] });
    },
  });
}

export function useDeleteTransaction(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTransaction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['wallets', tenantId] });
    },
  });
}
