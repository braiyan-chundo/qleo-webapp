import type { ReactNode } from 'react';
import { AlertCircle, BarChart3, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Primitivas compartidas de la vista de Analíticas (QL-66). Centraliza la tarjeta
 * contenedora, los stat tiles y el manejo de estados (carga/vacío/error) para que cada
 * widget se enfoque solo en su gráfico.
 *
 * Colores de los charts: se usan los **tokens M3** vía `var(--…)` (definidos en `index.css`),
 * así respetan claro/oscuro automáticamente. Orden categórico **fijo** (no se cicla):
 * cerrado = `primary`, abierto = `tertiary`. La identidad nunca va solo por color → todos
 * los charts llevan leyenda y/o etiqueta directa (guía `dataviz`).
 */
export const CHART_COLORS = {
  /** Serie "cerradas" / valor único principal. */
  closed: 'var(--primary)',
  /** Serie "abiertas". */
  open: 'var(--tertiary)',
  /** Adjuntos generales del proyecto. */
  attProject: 'var(--primary)',
  /** Adjuntos de tareas. */
  attTask: 'var(--tertiary)',
  /** Ejes y grilla (recesivos). */
  axis: 'var(--on-surface-variant)',
  grid: 'var(--outline-variant)',
} as const;

interface ChartCardProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Tarjeta contenedora estándar de un widget de analítica. */
export function ChartCard({
  title,
  description,
  action,
  className,
  children,
}: ChartCardProps) {
  return (
    <section
      className={cn(
        'rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5',
        className,
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-on-surface">{title}</h2>
          {description && (
            <p className="mt-0.5 text-xs text-on-surface-variant">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

interface StatTileProps {
  label: string;
  value: number | string;
  /** Resalta el número (p.ej. vencidas en `error`). */
  tone?: 'default' | 'error';
}

/** Número grande + etiqueta. Un "hero number", no un chart (guía `dataviz`). */
export function StatTile({ label, value, tone = 'default' }: StatTileProps) {
  return (
    <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-4">
      <p
        className={cn(
          'text-2xl font-bold tabular-nums sm:text-3xl',
          tone === 'error' ? 'text-error' : 'text-on-surface',
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-on-surface-variant sm:text-sm">{label}</p>
    </div>
  );
}

/** Rejilla responsive de stat tiles. */
export function StatTileGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {children}
    </div>
  );
}

/**
 * Envoltura de estados para un widget: muestra carga/error/vacío o el contenido. Evita
 * repetir el patrón en cada gráfico.
 */
export function ChartState({
  isLoading,
  isError,
  isEmpty,
  errorMessage,
  emptyMessage = 'Sin datos para mostrar.',
  children,
}: {
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  errorMessage?: string;
  emptyMessage?: string;
  children: ReactNode;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-on-surface-variant">
        <Loader2 className="size-4 animate-spin" />
        Cargando…
      </div>
    );
  }
  if (isError) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-error/20 bg-error-container/50 px-4 py-8 text-center">
        <AlertCircle className="size-6 text-on-error-container" />
        <p className="text-sm font-medium text-on-error-container">
          {errorMessage ?? 'No se pudieron cargar las métricas.'}
        </p>
      </div>
    );
  }
  if (isEmpty) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-outline-variant/60 px-4 py-10 text-center">
        <BarChart3 className="size-6 text-on-surface-variant" />
        <p className="text-sm text-on-surface-variant">{emptyMessage}</p>
      </div>
    );
  }
  return <>{children}</>;
}
