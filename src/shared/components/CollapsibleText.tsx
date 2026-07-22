import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface CollapsibleTextProps {
  /**
   * Cuerpo ya renderizado (texto plano, menciones resaltadas, enlaces…). Se pinta **tal cual**:
   * este componente solo recorta la caja, nunca toca el contenido, así que las menciones y los
   * saltos de línea del llamador siguen funcionando igual.
   */
  children: ReactNode;
  /** Nº de líneas visibles en estado colapsado. */
  lines?: number;
  /**
   * Clase Tailwind del **origen** del degradado de corte, que debe coincidir con el fondo sobre
   * el que se pinta el texto (p. ej. `from-surface-container` en una burbuja del muro). Token
   * Material 3, nunca un hex.
   */
  fadeFrom?: string;
  className?: string;
}

/**
 * (QL-173) "Leer más / Leer menos" para textos largos. Colapsa por **altura** (n.º de líneas
 * reales medidas en el DOM), no por número de caracteres: con saltos de línea y menciones el
 * conteo de caracteres miente, y una lista corta de 20 líneas quedaría sin recortar.
 *
 * Cómo mide: el contenido va en un div interno **sin recortar** cuya altura natural se observa
 * con `ResizeObserver`; el div externo es el que lleva el `max-height` del colapso. Así el
 * botón solo aparece cuando el texto **de verdad** desborda (y reaparece/desaparece al cambiar
 * el ancho de la ventana o el propio texto).
 *
 * Lo usan el cuerpo del mensaje del muro (`WallMessageItem`) y el del comentario de tarea
 * (`CommentsPanel`).
 */
export function CollapsibleText({
  children,
  lines = 6,
  fadeFrom = 'from-surface',
  className,
}: CollapsibleTextProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [maxHeight, setMaxHeight] = useState<number | null>(null);
  const [overflowing, setOverflowing] = useState(false);

  const measure = useCallback(() => {
    const content = contentRef.current;
    if (!content) return;
    // La altura de línea se lee del elemento que **pinta el texto** (normalmente el `<p>` que
    // envía el llamador con su `text-sm`), no del wrapper: el wrapper hereda la tipografía del
    // contenedor y daría un alto de línea distinto al real.
    const styles = window.getComputedStyle(content.firstElementChild ?? content);
    const parsed = Number.parseFloat(styles.lineHeight);
    // `line-height: normal` no es numérico: se aproxima a 1.5× el tamaño de fuente.
    const lineHeight = Number.isFinite(parsed)
      ? parsed
      : Number.parseFloat(styles.fontSize) * 1.5;
    if (!Number.isFinite(lineHeight) || lineHeight <= 0) return;
    const limit = Math.round(lineHeight * lines);
    setMaxHeight(limit);
    // Tolerancia de 1px: subpíxeles no deben disparar un "Leer más" que no recorta nada.
    setOverflowing(content.offsetHeight > limit + 1);
  }, [lines]);

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, [measure]);

  const collapsed = overflowing && !expanded;

  return (
    <div className={className}>
      <div
        className="relative overflow-hidden"
        style={collapsed && maxHeight != null ? { maxHeight } : undefined}
      >
        <div ref={contentRef}>{children}</div>
        {collapsed && (
          <span
            aria-hidden
            className={cn(
              'pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t to-transparent',
              fadeFrom,
            )}
          />
        )}
      </div>

      {overflowing && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-0.5 text-xs font-semibold text-primary underline-offset-2 hover:underline"
        >
          {expanded ? 'Leer menos' : 'Leer más'}
        </button>
      )}
    </div>
  );
}
