import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Category } from '@flowledger/interfaces';
import { createCategory, listCategories, updateCategory, deleteCategory } from '../repositories/categories.repo.js';

export function useCategories(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['categories', tenantId],
    queryFn: () => listCategories(tenantId!),
    enabled: Boolean(tenantId),
  });
}

export function useCreateCategory(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Category, 'id' | 'createdAt'>) => createCategory(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories', tenantId] }),
  });
}

export function useUpdateCategory(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Category> }) =>
      updateCategory(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories', tenantId] }),
  });
}

export function useDeleteCategory(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories', tenantId] }),
  });
}
