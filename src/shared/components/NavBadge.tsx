import { cn } from '@/lib/utils';

interface NavBadgeProps {
  /** Conteo a mostrar. Si es `<= 0`, el badge no se pinta (`null`). */
  count: number;
  /**
   * Clases extra de posicionamiento. Por defecto el badge se posiciona **absoluto** en la
   * esquina superior derecha de su contenedor `relative` (icono del nav). Pásale
   * posicionamiento propio (p. ej. `static`/inline) cuando acompañe a una etiqueta.
   */
  className?: string;
  /** Etiqueta accesible del badge (p. ej. "3 sin leer"). */
  label?: string;
}

/**
 * Badge numérico de no leídos del nav (QL-91). Mismo molde visual que el de la campana de
 * notificaciones: pastilla `bg-error`/`text-on-error`, `9+` como tope. Oculto en 0.
 */
export function NavBadge({ count, className, label }: NavBadgeProps) {
  if (count <= 0) return null;
  const text = count > 9 ? '9+' : String(count);
  return (
    <span
      aria-label={label ?? `${count} sin leer`}
      className={cn(
        'absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold leading-none text-on-error tabular-nums',
        className,
      )}
    >
      {text}
    </span>
  );
}
