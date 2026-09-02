import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import './ReorderableList.css';

const LONG_PRESS_MS = 450;
const CANCEL_MOVE_PX = 6;

interface ReorderableListProps<T> {
  items: T[];
  getId: (item: T) => string;
  /** beforeId/afterId — id соседей на новом месте (выше/ниже), null на краю списка. */
  onReorder: (id: string, beforeId: string | null, afterId: string | null) => void;
  renderItem: (item: T, dragging: boolean) => ReactNode;
}

/** Список с сортировкой long-press + перетаскиванием (как переупорядочивание
 *  строк в мобильных приложениях): держим строку ~450мс без движения — она
 *  «поднимается», дальше двигаем палец вверх/вниз, соседи расступаются.
 *  Короткий тап или горизонтальный свайп (для SwipeableRow внутри) через
 *  порог в 450мс не проходят — таймер отменяется при первом же заметном
 *  движении, обычные жесты строки продолжают работать как раньше.
 *
 *  Move/up во время самого перетаскивания слушаем на window, а не через
 *  пропсы React-элемента строки: после первого же свайпа соседей позиция
 *  строки в DOM меняется, и полагаться на то, что именно её узел окажется
 *  под пальцем к моменту отпускания, нельзя — окно всегда получает событие
 *  независимо от того, что сейчас под курсором. */
export function ReorderableList<T>({ items, getId, onReorder, renderItem }: ReorderableListProps<T>) {
  const [order, setOrder] = useState<string[]>(() => items.map(getId));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [offsetY, setOffsetY] = useState(0);

  const orderRef = useRef(order);
  orderRef.current = order;

  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const press = useRef<{
    id: string;
    startX: number;
    startY: number;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (draggingId) return;
    const ids = items.map(getId);
    setOrder((prev) => (prev.length === ids.length && prev.every((id, i) => id === ids[i]) ? prev : ids));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, draggingId]);

  useEffect(() => () => cleanupRef.current?.(), []);

  const itemById = new Map(items.map((item) => [getId(item), item]));

  function clearPress() {
    if (press.current) {
      clearTimeout(press.current.timer);
      press.current = null;
    }
  }

  function finishDrag(id: string, commit: boolean) {
    if (commit) {
      const currentOrder = orderRef.current;
      const index = currentOrder.indexOf(id);
      const beforeId = currentOrder[index - 1] ?? null;
      const afterId = currentOrder[index + 1] ?? null;
      onReorder(id, beforeId, afterId);
    }
    setDraggingId(null);
    setOffsetY(0);
  }

  function beginDrag(id: string, startY: number) {
    setDraggingId(id);
    setOffsetY(0);

    function onMove(e: PointerEvent) {
      e.preventDefault();
      setOffsetY(e.clientY - startY);

      const currentOrder = orderRef.current;
      const currentIndex = currentOrder.indexOf(id);
      const aboveId = currentOrder[currentIndex - 1];
      const belowId = currentOrder[currentIndex + 1];

      if (aboveId) {
        const rect = rowRefs.current.get(aboveId)?.getBoundingClientRect();
        if (rect && e.clientY < rect.top + rect.height / 2) {
          const next = currentOrder.slice();
          next.splice(currentIndex, 1);
          next.splice(currentIndex - 1, 0, id);
          setOrder(next);
          return;
        }
      }
      if (belowId) {
        const rect = rowRefs.current.get(belowId)?.getBoundingClientRect();
        if (rect && e.clientY > rect.top + rect.height / 2) {
          const next = currentOrder.slice();
          next.splice(currentIndex, 1);
          next.splice(currentIndex + 1, 0, id);
          setOrder(next);
        }
      }
    }

    function onEnd(commit: boolean) {
      return () => {
        cleanupRef.current = null;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
        finishDrag(id, commit);
      };
    }
    const onUp = onEnd(true);
    const onCancel = onEnd(false);

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    cleanupRef.current = onCancel;
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>, id: string) {
    const startX = e.clientX;
    const startY = e.clientY;
    press.current = {
      id,
      startX,
      startY,
      timer: setTimeout(() => {
        press.current = null;
        beginDrag(id, startY);
      }, LONG_PRESS_MS),
    };
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>, id: string) {
    if (press.current && press.current.id === id) {
      const dx = e.clientX - press.current.startX;
      const dy = e.clientY - press.current.startY;
      if (Math.hypot(dx, dy) > CANCEL_MOVE_PX) clearPress();
    }
  }

  function handlePointerUp() {
    clearPress();
  }

  return (
    <>
      {order.map((id) => {
        const item = itemById.get(id);
        if (!item) return null;
        const dragging = draggingId === id;
        return (
          <div
            key={id}
            ref={(el) => {
              if (el) rowRefs.current.set(id, el);
              else rowRefs.current.delete(id);
            }}
            className={`reorderable-row${dragging ? ' is-dragging' : ''}`}
            style={dragging ? { transform: `translateY(${offsetY}px)` } : undefined}
            onPointerDown={(e) => handlePointerDown(e, id)}
            onPointerMove={(e) => handlePointerMove(e, id)}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {renderItem(item, dragging)}
          </div>
        );
      })}
    </>
  );
}
