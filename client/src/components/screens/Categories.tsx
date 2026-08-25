import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useOutletContext } from 'react-router-dom';
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  categoryFormSchema,
  type CategoryFormValues,
  type UseAuthResult,
} from '@flowledger/shared';

export function Categories() {
  const { user } = useOutletContext<{ user: UseAuthResult['user'] }>();
  const { data: categories, isLoading } = useCategories(user?.tenantId);
  const createCategory = useCreateCategory(user?.tenantId);
  const deleteCategory = useDeleteCategory(user?.tenantId);

  const { register, handleSubmit, reset, formState } = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: { name: '', type: 'expense' },
  });

  async function onSubmit(values: CategoryFormValues) {
    if (!user) return;
    await createCategory.mutateAsync({ ...values, tenantId: user.tenantId });
    reset();
  }

  return (
    <div>
      <h1>Категории</h1>

      <form onSubmit={handleSubmit(onSubmit)}>
        <input placeholder="Название" {...register('name')} />
        {formState.errors.name && <span>{formState.errors.name.message}</span>}
        <select {...register('type')}>
          <option value="expense">Расход</option>
          <option value="income">Доход</option>
        </select>
        <button type="submit" disabled={createCategory.isPending}>Добавить</button>
      </form>

      {isLoading && <p>Загрузка...</p>}

      <h2>Расходы</h2>
      <ul>
        {categories?.filter((c) => c.type === 'expense').map((c) => (
          <li key={c.id}>
            {c.name}
            <button type="button" onClick={() => deleteCategory.mutate(c.id)}>Удалить</button>
          </li>
        ))}
      </ul>

      <h2>Доходы</h2>
      <ul>
        {categories?.filter((c) => c.type === 'income').map((c) => (
          <li key={c.id}>
            {c.name}
            <button type="button" onClick={() => deleteCategory.mutate(c.id)}>Удалить</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
