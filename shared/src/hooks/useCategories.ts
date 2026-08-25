import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Category } from '@flowledger/interfaces';
import { createCategory, listCategories, updateCategory, deleteCategory } from '../repositories/categories.repo.js';

export function useCategories(enabled: boolean) {
  return useQuery({
    queryKey: ['categories'],
    queryFn: listCategories,
    enabled,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Category, 'id' | 'createdAt'>) => createCategory(input),
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
