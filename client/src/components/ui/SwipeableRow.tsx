import { useRef, useState, type ReactNode } from 'react';
import './SwipeableRow.css';

const ACTION_WIDTH = 88;
const OPEN_THRESHOLD = ACTION_WIDTH / 2;

interface SwipeableRowProps {
  children: ReactNode;
  actionLabel: string;
  actionVariant?: 'danger' | 'positive';
  onAction: () => void;
  onClick?: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Свайп влево открывает кнопку-действие под строкой (архивирование или
 *  восстановление в списке кошельков на телефоне) — открытое/закрытое
 *  состояние строки контролирует родитель, чтобы свайп одной строки
 *  закрывал остальные. Pointer Events вместо Touch — один код для тача,
 *  мыши и стилуса. */
export function SwipeableRow({
  children,
  actionLabel,
  actionVariant = 'danger',
  onAction,
  onClick,
  open,
  onOpenChange,
}: SwipeableRowProps) {
  const [dragX, setDragX] = useState<number | null>(null);
  const startX = useRef(0);
  const startedOpen = useRef(false);
  const wasDrag = useRef(false);

  const translateX = dragX ?? (open ? -ACTION_WIDTH : 0);

  function handlePointerDown(e: React.PointerEvent) {
    startX.current = e.clientX;
    startedOpen.current = open;
    wasDrag.current = false;
    setDragX(open ? -ACTION_WIDTH : 0);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (dragX === null) return;
    const delta = e.clientX - startX.current;
    if (Math.abs(delta) > 4) wasDrag.current = true;
    const base = startedOpen.current ? -ACTION_WIDTH : 0;
    setDragX(Math.min(0, Math.max(-ACTION_WIDTH, base + delta)));
  }

  function handlePointerUp() {
    if (dragX !== null) {
      onOpenChange(dragX <= -OPEN_THRESHOLD);
    }
    setDragX(null);
  }

  function handleSurfaceClick() {
    if (wasDrag.current) {
      wasDrag.current = false;
      return;
    }
    if (open) {
      onOpenChange(false);
      return;
    }
    onClick?.();
  }

  return (
    <div className="list-row swipeable-row">
      <button
        type="button"
        className={`swipeable-row__action swipeable-row__action--${actionVariant}`}
        style={{ width: ACTION_WIDTH }}
        onClick={() => {
          onAction();
          onOpenChange(false);
        }}
      >
        {actionLabel}
      </button>
      <div
        className="swipeable-row__surface"
        style={{
          transform: `translateX(${translateX}px)`,
          transition: dragX === null ? 'transform 0.2s ease' : 'none',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleSurfaceClick}
      >
        {children}
      </div>
    </div>
  );
}
