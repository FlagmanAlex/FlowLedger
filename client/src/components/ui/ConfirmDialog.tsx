import './ConfirmDialog.css';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Ошибка последней попытки — например, действие требует сети/индекса и
   *  падает; без этого поля сбой проходил бы тихо (диалог просто закрылся
   *  бы, ничего не сделав). */
  error?: string | null;
  isPending?: boolean;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Удалить',
  cancelLabel = 'Отмена',
  onConfirm,
  onCancel,
  error,
  isPending,
}: ConfirmDialogProps) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-sheet confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <span className="modal-sheet__title">{title}</span>
        <p className="state-message">{message}</p>
        {error && (
          <p className="state-message" role="alert">
            {error}
          </p>
        )}
        <div className="confirm-dialog__actions">
          <button type="button" className="neo-button neo-button--full" onClick={onCancel} disabled={isPending}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className="neo-button neo-button--full neo-button--danger"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? 'Удаление…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
