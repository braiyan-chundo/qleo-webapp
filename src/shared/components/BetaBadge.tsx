import { cn } from '@/lib/utils';

/**
 * Píldora "Beta" que acompaña al logo de Qleo (QL-74).
 *
 * Color: par contenedor/on-contenedor **terciario** (ámbar en claro, amarillo neón en
 * oscuro). Elegido sobre `secondary` porque el ámbar es la convención universal para
 * marcar una fase beta y no se confunde con el `primary` de la marca (azul en claro,
 * rosa en oscuro) ni con el verde de `secondary`, que lee como "éxito". Funciona en
 * ambos temas sin hex.
 *
 * No es interactivo: un `<span>` con el texto "Beta 1.0.0" ya es legible por lectores de
 * pantalla, así que no lleva `aria-label` redundante.
 *
 * QL-116: junto a "Beta" mostramos la versión del producto (`__APP_VERSION__`, inyectada
 * por Vite desde `package.json`), p.ej. "BETA 1.0.0" tras el `uppercase`.
 */
interface BetaBadgeProps {
  className?: string;
  /** Escala tipográfica: `sm` (11px) por defecto, `xs` (10px) para logos pequeños. */
  size?: 'sm' | 'xs';
  /** Muestra la versión del producto junto a "Beta". Por defecto `true`. */
  showVersion?: boolean;
  /** Sobrescribe la versión mostrada; por defecto se lee de `__APP_VERSION__`. */
  version?: string;
}

export function BetaBadge({
  className,
  size = 'sm',
  showVersion = true,
  version,
}: BetaBadgeProps) {
  const resolvedVersion = version ?? __APP_VERSION__;
  const label = showVersion ? `Beta ${resolvedVersion}` : 'Beta';

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full bg-tertiary-container px-1.5 py-0.5',
        'font-semibold uppercase tracking-wide leading-none text-on-tertiary-container',
        size === 'xs' ? 'text-[10px]' : 'text-[11px]',
        className,
      )}
    >
      {label}
    </span>
  );
}
