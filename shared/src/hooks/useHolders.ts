import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Holder } from '@flowledger/interfaces';
import { createHolder, listHolders } from '../repositories/holders.repo.js';

export function useHolders(userId: string | undefined) {
  return useQuery({
    queryKey: ['holders', userId],
    queryFn: () => listHolders(userId!),
    enabled: Boolean(userId),
  });
}

export function useCreateHolder(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Holder, 'id' | 'userId' | 'createdAt'>) => createHolder(userId!, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['holders'] }),
  });
}
