import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useOutletContext } from 'react-router-dom';
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  categoryFormSchema,
  type CategoryFormValues,
} from '@flowledger/shared';
import type { Category } from '@flowledger/interfaces';
import type { MainOutletContext } from '@/components/layouts/MainLayout';
import { IconCircle } from '@/components/ui/IconCircle';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { colorForId } from '@/lib/palette';
import './forms.css';

export function Categories() {
  const { ownerId } = useOutletContext<MainOutletContext>();
  const { data: categories, isLoading } = useCategories(ownerId);
  const createCategory = useCreateCategory(ownerId);
  const deleteCategory = useDeleteCategory();
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  const { register, handleSubmit, reset, formState } = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: { name: '', type: 'expense' },
  });

  async function onSubmit(values: CategoryFormValues) {
    if (!ownerId) return;
    await createCategory.mutateAsync(values);
    reset();
  }

  return (
    <div className="page">
      <h1 className="page__title">Категории</h1>

      <section className="neo-card">
        <form className="create-form" onSubmit={handleSubmit(onSubmit)}>
          <div className="field">
            <input className="neo-input" placeholder="Название" {...register('name')} />
            {formState.errors.name && (
              <span className="field__error">{formState.errors.name.message}</span>
            )}
          </div>
          <div className="field">
            <select className="neo-input" {...register('type')}>
              <option value="expense">Расход</option>
              <option value="income">Доход</option>
            </select>
          </div>
          <button
            type="submit"
            className="neo-button neo-button--accent"
            disabled={createCategory.isPending}
          >
            Добавить
          </button>
        </form>
      </section>

      {isLoading && <p className="state-message">Загрузка...</p>}

      <section className="neo-card">
        <h2 className="section-title">Расходы</h2>
        {categories?.filter((c) => c.type === 'expense').map((c) => (
          <div key={c.id} className="list-row">
            <IconCircle label={c.name} color={c.color ?? colorForId(c.id)} size={36} />
            <div className="list-row__main">
              <div className="list-row__title">{c.name}</div>
            </div>
            <button
              type="button"
              className="neo-button neo-button--sm"
              onClick={() => setCategoryToDelete(c)}
            >
              Удалить
            </button>
          </div>
        ))}
      </section>

      <section className="neo-card">
        <h2 className="section-title">Доходы</h2>
        {categories?.filter((c) => c.type === 'income').map((c) => (
          <div key={c.id} className="list-row">
            <IconCircle label={c.name} color={c.color ?? colorForId(c.id)} size={36} />
            <div className="list-row__main">
              <div className="list-row__title">{c.name}</div>
            </div>
            <button
              type="button"
              className="neo-button neo-button--sm"
              onClick={() => setCategoryToDelete(c)}
            >
              Удалить
            </button>
          </div>
        ))}
      </section>

      {categoryToDelete && (
        <ConfirmDialog
          title="Удалить категорию?"
          message={`«${categoryToDelete.name}» пропадёт из списка категорий. Уже сохранённые операции с этой категорией останутся — в них категория будет показана как «Без категории».`}
          onCancel={() => setCategoryToDelete(null)}
          onConfirm={() => {
            deleteCategory.mutate(categoryToDelete.id);
            setCategoryToDelete(null);
          }}
        />
      )}
    </div>
  );
}
