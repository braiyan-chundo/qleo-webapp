import { cn } from '@/lib/utils';
import { QleoMark } from '@/shared/components/QleoLogo';

/**
 * Loader por defecto de Qleo. Usa la marca (`QleoMark`) con las barras "latiendo" en
 * secuencia (ver `qleo-mark-bar` en `index.css`): sube/baja escalonado, evocando el
 * carácter de organización/analítica del icono. Sutil, fluido y sin layout shift (la
 * animación es sólo `transform`/`opacity`, respeta `prefers-reduced-motion`).
 *
 * El color sigue el token del contexto; por defecto `text-primary`.
 *
 * - Inline: `<QleoLoader />` centra sólo el icono.
 * - Página completa: `<QleoLoader fullPage label="Cargando…" />` cubre el viewport,
 *   centrado, con un texto opcional debajo.
 */
interface QleoLoaderProps {
  /** Tamaño del icono en px. */
  size?: number;
  /** Texto bajo el icono (p.ej. "Cargando tu sesión…"). */
  label?: string;
  /** Variante a pantalla completa (centrada en el viewport). */
  fullPage?: boolean;
  className?: string;
}

export function QleoLoader({
  size = 48,
  label,
  fullPage = false,
  className,
}: QleoLoaderProps) {
  const content = (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 text-primary',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <QleoMark size={size} animated className="qleo-mark-pulse" />
      {label ? (
        <p className="text-sm font-medium text-on-surface-variant">{label}</p>
      ) : (
        <span className="sr-only">Cargando…</span>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="flex min-h-dvh w-full items-center justify-center bg-surface">
        {content}
      </div>
    );
  }

  return content;
}
