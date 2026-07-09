import type { CSSProperties, SVGProps } from 'react';
import { cn } from '@/lib/utils';
import { BetaBadge } from '@/shared/components/BetaBadge';

/**
 * Marca de Qleo (icono): una "Q" formada por lente redondeada + 2 barras + mango de lupa.
 *
 * Es **mono-color con `currentColor`**: el color lo gobierna el token del contexto
 * (`text-primary`, `text-inverse-primary`, …), nunca un hex. Así sigue el tema claro/oscuro.
 *
 * - Decorativo por defecto (`aria-hidden`). Si se usa de forma independiente, pasa `label`
 *   para exponerlo como `role="img"` con nombre accesible.
 * - El tamaño se controla con `size` (px) o con clases utilitarias en `className`
 *   (`size-*`); el color con `text-*`.
 * - `animated` activa las barras "latiendo" en secuencia (lo usa `QleoLoader`).
 */
interface QleoMarkProps
  extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  size?: number | string;
  label?: string;
  animated?: boolean;
}

export function QleoMark({
  className,
  size,
  label,
  animated = false,
  ...props
}: QleoMarkProps) {
  const a11y = label
    ? ({ role: 'img', 'aria-label': label } as const)
    : ({ 'aria-hidden': true, focusable: false } as const);

  const barClass = animated ? 'qleo-mark-bar' : undefined;

  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      {...a11y}
      {...props}
    >
      {/* Lente / marco redondeado (cuerpo de la Q) */}
      <rect
        x="16"
        y="14"
        width="56"
        height="56"
        rx="19"
        fill="none"
        stroke="currentColor"
        strokeWidth="12"
      />
      {/* Mango / cola de la Q (lupa) */}
      <path
        d="M61 59 L85 83"
        stroke="currentColor"
        strokeWidth="13"
        strokeLinecap="round"
      />
      {/* Barras (organización / analítica) */}
      <rect
        x="29"
        y="42"
        width="13"
        height="16"
        rx="3.5"
        fill="currentColor"
        className={barClass}
        style={animated ? ({ '--qleo-bar-delay': '0ms' } as CSSProperties) : undefined}
      />
      <rect
        x="47"
        y="30"
        width="13"
        height="28"
        rx="3.5"
        fill="currentColor"
        className={barClass}
        style={animated ? ({ '--qleo-bar-delay': '160ms' } as CSSProperties) : undefined}
      />
    </svg>
  );
}

/**
 * Logo completo de Qleo: icono + wordmark "Qleo".
 *
 * Ambas piezas heredan el color del contenedor (el mark vía `currentColor`, el texto vía
 * la propiedad `color`), así que un único token de color en `className` gobierna todo el
 * logo. Por defecto no fuerza color: el sitio de uso aplica su token (p.ej.
 * `text-primary dark:text-inverse-primary`).
 */
interface QleoLogoProps {
  /** Color/estado del logo completo (se aplica al contenedor). */
  className?: string;
  /** Tamaño del icono en px. El wordmark escala con `textClassName`. */
  size?: number | string;
  /** Ajustes del icono (además del tamaño). */
  markClassName?: string;
  /** Tipografía/tamaño del wordmark. */
  textClassName?: string;
  /** Oculta el wordmark (equivale a usar sólo `QleoMark`, útil en layouts responsive). */
  hideWordmark?: boolean;
  /** Muestra la píldora "Beta" tras el wordmark (QL-74). */
  beta?: boolean;
}

export function QleoLogo({
  className,
  size = 32,
  markClassName,
  textClassName,
  hideWordmark = false,
  beta = false,
}: QleoLogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <QleoMark size={size} className={markClassName} label="Qleo" />
      {!hideWordmark && (
        <span
          className={cn(
            'font-heading font-bold leading-none tracking-tight',
            textClassName,
          )}
        >
          Qleo
        </span>
      )}
      {beta && <BetaBadge className="self-start" size="xs" />}
    </span>
  );
}
