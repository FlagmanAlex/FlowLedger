import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Counterparty } from '@flowledger/interfaces';
import { createCounterparty, listCounterparties } from '../repositories/counterparties.repo.js';

export function useCounterparties(userId: string | undefined) {
  return useQuery({
    queryKey: ['counterparties', userId],
    queryFn: () => listCounterparties(userId!),
    enabled: Boolean(userId),
  });
}

export function useCreateCounterparty(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Counterparty, 'id' | 'userId' | 'createdAt'>) =>
      createCounterparty(userId!, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['counterparties'] }),
  });
}
