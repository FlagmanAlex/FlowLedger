import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Category } from '@flowledger/interfaces';
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from '../repositories/categories.repo.js';

export function useCategories(userId: string | undefined) {
  return useQuery({
    queryKey: ['categories', userId],
    queryFn: () => listCategories(userId!),
    enabled: Boolean(userId),
  });
}

export function useCreateCategory(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Category, 'id' | 'userId' | 'createdAt'>) =>
      createCategory(userId!, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Category> }) =>
      updateCategory(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  });
}
