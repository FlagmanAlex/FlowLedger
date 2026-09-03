import './ConfirmDialog.css';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Удалить',
  cancelLabel = 'Отмена',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-sheet confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <span className="modal-sheet__title">{title}</span>
        <p className="state-message">{message}</p>
        <div className="confirm-dialog__actions">
          <button type="button" className="neo-button neo-button--full" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className="neo-button neo-button--full neo-button--danger"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
