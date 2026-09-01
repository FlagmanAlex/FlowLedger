import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Currency } from '@flowledger/interfaces';
import { createCurrency, listCurrencies } from '../repositories/currencies.repo.js';

export function useCurrencies(userId: string | undefined) {
  return useQuery({
    queryKey: ['currencies', userId],
    queryFn: () => listCurrencies(userId!),
    enabled: Boolean(userId),
  });
}

export function useCreateCurrency(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Currency, 'id' | 'userId' | 'createdAt'>) => createCurrency(userId!, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['currencies'] }),
  });
}
