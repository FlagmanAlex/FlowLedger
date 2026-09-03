import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import './ReorderableList.css';

const LONG_PRESS_MS = 450;
const CANCEL_MOVE_PX = 6;

export interface DragHandleProps {
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => void;
  onClick: (e: ReactMouseEvent<HTMLElement>) => void;
  style: CSSProperties;
}

interface ReorderableListProps<T> {
  items: T[];
  getId: (item: T) => string;
  /** beforeId/afterId — id соседей на новом месте (выше/ниже), null на краю списка. */
  onReorder: (id: string, beforeId: string | null, afterId: string | null) => void;
  /** handleProps — навесить на маленькую ручку (⠿) внутри строки, см. .reorder-handle. */
  renderItem: (item: T, dragging: boolean, handleProps: DragHandleProps) => ReactNode;
}

const HANDLE_STYLE: CSSProperties = { touchAction: 'none' };

/** Список с сортировкой long-press + перетаскиванием (как переупорядочивание
 *  строк в мобильных приложениях): держим ручку ~450мс без движения — она
 *  «поднимается», дальше двигаем палец вверх/вниз, соседи расступаются.
 *
 *  Долгое нажатие берётся с отдельной ручки внутри строки, а не со всей
 *  строки целиком — не просто стилистический выбор. У строки задан
 *  touch-action: pan-y (чтобы страница скроллилась через список), а
 *  touch-action фактически фиксируется браузером на начало жеста —
 *  переключить его на none в середине уже начавшегося на строке касания
 *  ненадёжно на реальных устройствах. У ручки touch-action: none стоит
 *  всегда, с самого начала — гонки нет, а скролл через остальную часть
 *  строки продолжает работать.
 *
 *  Move/up во время активного перетаскивания слушаем на window, а не через
 *  пропсы React-элемента: после первого же свайпа соседей DOM-позиция
 *  строки меняется, и полагаться, что именно её узел окажется под пальцем
 *  к моменту отпускания, нельзя. Пропагацию pointerdown/move/up с ручки
 *  наверх НЕ останавливаем (важно!) — иначе те же самые window-слушатели
 *  ниже не получат события вообще (перетаскивание сдвигается на пиксель
 *  и тут же откатывается — стоило один раз ошибиться с stopPropagation).
 *  От случайного открытия карточки на редактирование после перетаскивания
 *  ручкой защищаемся отдельно — глушим только сам click. */
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

    /* Перетаскиваемая строка рендерится в своей ТЕКУЩЕЙ позиции в потоке
     *  (по индексу в order) плюс transform: translateY(offsetY). Свап
     *  соседей меняет её позицию в потоке на высоту соседа — без поправки
     *  строка в тот же миг «прыгает» на эту высоту, потому что offsetY
     *  как было отсчитано от исходной точки нажатия, так и остаётся.
     *  shift компенсирует этот прыжок, накапливая высоту каждого свапа. */
    let shift = 0;

    function onMove(e: PointerEvent) {
      e.preventDefault();

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
          shift += rect.height;
          setOffsetY(e.clientY - startY + shift);
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
          shift -= rect.height;
          setOffsetY(e.clientY - startY + shift);
          return;
        }
      }

      setOffsetY(e.clientY - startY + shift);
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

  function handlePointerDown(e: ReactPointerEvent<HTMLElement>, id: string) {
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

  function handlePointerMove(e: ReactPointerEvent<HTMLElement>, id: string) {
    if (press.current && press.current.id === id) {
      const dx = e.clientX - press.current.startX;
      const dy = e.clientY - press.current.startY;
      if (Math.hypot(dx, dy) > CANCEL_MOVE_PX) clearPress();
    }
  }

  function handlePointerUp() {
    clearPress();
  }

  /** Долгое перетаскивание ручкой не должно попутно открывать карточку на
   *  редактирование (клик — на всей строке, ручка внутри неё). */
  function handleHandleClick(e: ReactMouseEvent<HTMLElement>) {
    e.stopPropagation();
  }

  return (
    <>
      {order.map((id) => {
        const item = itemById.get(id);
        if (!item) return null;
        const dragging = draggingId === id;
        const handleProps: DragHandleProps = {
          onPointerDown: (e) => handlePointerDown(e, id),
          onPointerMove: (e) => handlePointerMove(e, id),
          onPointerUp: handlePointerUp,
          onPointerCancel: handlePointerUp,
          onClick: handleHandleClick,
          style: HANDLE_STYLE,
        };
        return (
          <div
            key={id}
            ref={(el) => {
              if (el) rowRefs.current.set(id, el);
              else rowRefs.current.delete(id);
            }}
            className={`reorderable-row${dragging ? ' is-dragging' : ''}`}
            style={dragging ? { transform: `translateY(${offsetY}px)` } : undefined}
          >
            {renderItem(item, dragging, handleProps)}
          </div>
        );
      })}
    </>
  );
}
