import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Transaction } from '@flowledger/interfaces';
import {
  createTransaction,
  deleteTransaction,
  listTransactions,
  type TransactionFilters,
  updateTransaction,
} from '../repositories/transactions.repo.js';

export function useTransactions(userId: string | undefined, filters: TransactionFilters = {}) {
  return useQuery({
    queryKey: ['transactions', userId, filters],
    queryFn: () => listTransactions(userId!, filters),
    enabled: Boolean(userId),
  });
}

export function useCreateTransaction(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Transaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) =>
      createTransaction(userId!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Transaction> }) =>
      updateTransaction(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTransaction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
    },
  });
}
