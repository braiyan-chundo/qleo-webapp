import type { ReactNode } from 'react';
import { BarChart3 } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Primitivas visuales de las gráficas del panel ADMIN (QL-112). Espejo ligero de las de
 * Analíticas (QL-66) pero **local al feature dashboard** para no acoplar features entre sí.
 * Las constantes/helpers (colores, formato) viven en `chart-utils.ts`.
 */

interface ChartCardProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Tarjeta contenedora estándar de una gráfica del dashboard. */
export function ChartCard({ title, description, action, className, children }: ChartCardProps) {
  return (
    <section
      className={cn(
        'flex flex-col rounded-xl border border-outline-variant/40 bg-surface-container-low p-5',
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

/** Estado vacío compartido de una gráfica (sin datos en el periodo). */
export function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-outline-variant/60 px-4 py-10 text-center">
      <BarChart3 className="size-6 text-on-surface-variant" />
      <p className="text-sm text-on-surface-variant">{message}</p>
    </div>
  );
}

/** Caja de tooltip estándar (mismo estilo que Analíticas) para reusar en cada gráfica. */
export function ChartTooltipBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-3 py-2 text-xs shadow-md">
      {children}
    </div>
  );
}
