import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Debt } from '@flowledger/interfaces';
import {
  createDebt,
  type CreateDebtInput,
  deleteDebt,
  getDebtOpeningTransaction,
  listDebts,
  repayDebt,
  type RepayDebtInput,
  updateDebt,
  updateDebtOpening,
  type UpdateDebtOpeningInput,
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

/** Открывающая операция долга — нужна DebtModal, чтобы дать редактировать
 *  сумму/кошелёк/дату/описание после создания (см. updateDebtOpening). */
export function useDebtOpeningTransaction(userId: string | undefined, debtId: string | undefined) {
  return useQuery({
    queryKey: ['debtOpeningTransaction', userId, debtId],
    queryFn: () => getDebtOpeningTransaction(userId!, debtId!),
    enabled: Boolean(userId) && Boolean(debtId),
  });
}

export function useUpdateDebtOpening() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      debt,
      openingTransactionId,
      input,
    }: {
      debt: Debt;
      openingTransactionId: string;
      input: UpdateDebtOpeningInput;
    }) => updateDebtOpening(debt, openingTransactionId, input),
    onSuccess: () => invalidateDebtsAndMoney(queryClient),
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
