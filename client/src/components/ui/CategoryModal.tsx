import { useState } from 'react';
import { useCreateCategory, useDeleteCategory, useUpdateCategory } from '@flowledger/shared';
import type { Category, CategoryType } from '@flowledger/interfaces';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PALETTE } from '@/lib/palette';
import './CategoryModal.css';

interface CategoryModalProps {
  ownerId: string | undefined;
  category?: Category;
  onClose: () => void;
}

const CATEGORY_ICONS = ['🛒', '🍔', '🚗', '🏠', '💊', '🎓', '🎁', '🎬', '✈️', '💡', '💼', '📈'];

export function CategoryModal({ ownerId, category, onClose }: CategoryModalProps) {
  const createCategory = useCreateCategory(ownerId);
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const isEditing = Boolean(category);

  const [name, setName] = useState(category?.name ?? '');
  const [type, setType] = useState<CategoryType>(category?.type ?? 'expense');
  const [icon, setIcon] = useState<string | undefined>(category?.icon);
  const [color, setColor] = useState<string | undefined>(category?.color);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName || !ownerId) {
      setError('Укажите название');
      return;
    }

    setError(null);
    const patch = {
      name: trimmedName,
      type,
      icon: icon || undefined,
      color: color || undefined,
    };

    try {
      if (category) {
        await updateCategory.mutateAsync({ id: category.id, patch });
      } else {
        await createCategory.mutateAsync(patch);
      }
      onClose();
    } catch (err) {
      console.error('Не удалось сохранить категорию', err);
      setError(err instanceof Error ? err.message : 'Не удалось сохранить категорию');
    }
  }

  const isSaving = createCategory.isPending || updateCategory.isPending;

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="modal-sheet__header">
            <button type="button" className="neo-button neo-button--icon" onClick={onClose}>
              ✕
            </button>
            <span className="modal-sheet__title">{isEditing ? 'Категория' : 'Новая категория'}</span>
            <span style={{ width: 44 }} />
          </div>

          <div className="field">
            <input
              className="neo-input"
              type="text"
              placeholder="Название"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="segmented">
            <button
              type="button"
              className={`segmented__item${type === 'expense' ? ' is-active' : ''}`}
              onClick={() => setType('expense')}
            >
              Расход
            </button>
            <button
              type="button"
              className={`segmented__item${type === 'income' ? ' is-active' : ''}`}
              onClick={() => setType('income')}
            >
              Доход
            </button>
          </div>

          <div className="category-modal__section">
            <h3 className="section-title">Значок</h3>
            <div className="category-modal__icon-grid">
              {CATEGORY_ICONS.map((i) => (
                <button
                  key={i}
                  type="button"
                  className={`category-modal__icon-cell${icon === i ? ' is-selected' : ''}`}
                  onClick={() => setIcon(icon === i ? undefined : i)}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          <div className="category-modal__section">
            <h3 className="section-title">Цвет</h3>
            <div className="category-modal__color-row">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`category-modal__color-swatch${color === c ? ' is-selected' : ''}`}
                  style={{ background: c }}
                  aria-label={c}
                  onClick={() => setColor(color === c ? undefined : c)}
                />
              ))}
            </div>
          </div>

          {error && (
            <p className="state-message" role="alert">
              {error}
            </p>
          )}

          <button
            type="button"
            className="neo-button neo-button--accent neo-button--full"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Сохранение…' : isEditing ? 'Сохранить' : 'Добавить'}
          </button>

          {isEditing && (
            <button
              type="button"
              className="neo-button neo-button--full neo-button--danger"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Удалить категорию
            </button>
          )}
        </div>
      </div>

      {showDeleteConfirm && category && (
        <ConfirmDialog
          title="Удалить категорию?"
          message={`«${category.name}» пропадёт из списка категорий. Уже сохранённые операции с этой категорией останутся — в них категория будет показана как «Без категории».`}
          onCancel={() => setShowDeleteConfirm(false)}
          error={deleteError}
          isPending={deleteCategory.isPending}
          onConfirm={async () => {
            setDeleteError(null);
            try {
              await deleteCategory.mutateAsync(category.id);
              onClose();
            } catch (err) {
              console.error('Не удалось удалить категорию', err);
              setDeleteError(err instanceof Error ? err.message : 'Не удалось удалить категорию');
            }
          }}
        />
      )}
    </>
  );
}
