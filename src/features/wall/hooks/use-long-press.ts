import { useCallback, useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

/** Handlers a esparcir sobre el elemento que detecta el long-press (la burbuja del mensaje). */
export interface LongPressHandlers {
  onPointerDown: (e: ReactPointerEvent) => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onPointerMove: () => void;
  onPointerCancel: () => void;
}

/**
 * (QL-147) Detecta un **long-press** (pulsación mantenida ~450 ms sin desplazarse) para abrir la
 * barra de reacciones en **táctil**, donde no hay `hover`. Ignora el ratón (`pointerType==='mouse'`):
 * en desktop la barra se abre al pasar el cursor, así que el long-press es solo para dedo/lápiz.
 * Cualquier movimiento (scroll) o `pointerup` temprano cancela el gesto.
 */
export function useLongPress(onLongPress: () => void, ms = 450): LongPressHandlers {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const callback = useRef(onLongPress);
  callback.current = onLongPress;

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = undefined;
    }
  }, []);

  // Limpia el temporizador si el componente se desmonta a mitad de una pulsación.
  useEffect(() => clear, [clear]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (e.pointerType === 'mouse') return;
      clear();
      timer.current = setTimeout(() => callback.current(), ms);
    },
    [clear, ms],
  );

  return {
    onPointerDown,
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerMove: clear,
    onPointerCancel: clear,
  };
}
