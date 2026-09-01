import { useQuery } from '@tanstack/react-query';
import { listCurrencies } from '../repositories/currencies.repo.js';

export function useCurrencies(userId: string | undefined) {
  return useQuery({
    queryKey: ['currencies', userId],
    queryFn: () => listCurrencies(userId!),
    enabled: Boolean(userId),
  });
}
