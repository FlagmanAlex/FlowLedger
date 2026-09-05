import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Debt } from '@flowledger/interfaces';
import {
  createDebt,
  type CreateDebtInput,
  deleteDebt,
  listDebts,
  repayDebt,
  type RepayDebtInput,
  updateDebt,
} from '../repositories/debts.repo.js';

function invalidateDebtsAndMoney(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['debts'] });
  queryClient.invalidateQueries({ queryKey: ['transactions'] });
  queryClient.invalidateQueries({ queryKey: ['wallets'] });
}

export function useDebts(userId: string | undefined) {
  return useQuery({
    queryKey: ['debts', userId],
    queryFn: () => listDebts(userId!),
    enabled: Boolean(userId),
  });
}

export function useCreateDebt(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ input, createdBy }: { input: CreateDebtInput; createdBy: string }) =>
      createDebt(userId!, input, createdBy),
    onSuccess: () => invalidateDebtsAndMoney(queryClient),
  });
}

export function useUpdateDebt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateDebt>[1] }) =>
      updateDebt(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['debts'] }),
  });
}

export function useRepayDebt(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ debt, input, createdBy }: { debt: Debt; input: RepayDebtInput; createdBy: string }) =>
      repayDebt(userId!, debt, input, createdBy),
    onSuccess: () => invalidateDebtsAndMoney(queryClient),
  });
}

export function useDeleteDebt(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDebt(userId!, id),
    onSuccess: () => invalidateDebtsAndMoney(queryClient),
  });
}
