import { FolderOpen, ListFilter, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import {
  NOTIFICATION_TYPE_LABELS,
  type NotificationFacets,
} from '../services/notifications.service';
import type { NotificationFiltersApi } from '../hooks/use-notification-filters';

interface NotificationFiltersProps {
  api: NotificationFiltersApi;
  facets: NotificationFacets | undefined;
  isLoading: boolean;
  /**
   * Título de la tarea filtrada, si se pudo deducir de las notificaciones cargadas. Sin él, el
   * chip de tarea se pinta con un texto genérico (no hay endpoint de facets por tarea, §3.36).
   */
  taskLabel?: string;
}

/**
 * Filtros de la bandeja (QL-137): **tipo** (multi-selección → CSV) y **proyecto**, ambos con
 * los contadores de `GET /notifications/facets`, más el chip de la **tarea** activa.
 *
 * Los contadores son el **tamaño del filtro** (cuentan leídas + no leídas, §3.36), no un badge
 * de pendientes: por eso no se ocultan al activar "No leídas". Un tipo/proyecto con 0 notis no
 * viene en los facets y **no se pinta**: no se ofrecen filtros que no devuelven nada.
 *
 * No hay facets por tarea, así que el filtro de tarea no es un desplegable: se activa desde el
 * menú de una notificación ("Solo esta tarea") y aquí solo se muestra —y se quita— como chip.
 */
export function NotificationFilters({
  api,
  facets,
  isLoading,
  taskLabel,
}: NotificationFiltersProps) {
  const { filters, hasContentFilters, toggleType, setProject, setTask, clearAll } = api;

  if (isLoading && !facets) {
    return (
      <div className="mt-4 space-y-3">
        <Skeleton className="h-7 w-full max-w-md rounded-full" />
        <Skeleton className="h-7 w-full max-w-xs rounded-full" />
      </div>
    );
  }

  const byType = facets?.byType ?? [];
  const byProject = facets?.byProject ?? [];
  const showProjects = byProject.length > 0;

  // Sin ningún facet no hay nada que filtrar (bandeja vacía): la barra sobra por completo.
  if (byType.length === 0 && !showProjects && !hasContentFilters) return null;

  return (
    <section aria-label="Filtros" className="mt-4 space-y-2.5">
      {byType.length > 0 && (
        <FilterRow icon={<ListFilter className="size-3.5" />} label="Tipo">
          {byType.map(({ type, count }) => (
            <FilterChip
              key={type}
              active={filters.types.includes(type)}
              onClick={() => toggleType(type)}
              count={count}
            >
              {NOTIFICATION_TYPE_LABELS[type] ?? type}
            </FilterChip>
          ))}
        </FilterRow>
      )}

      {showProjects && (
        <FilterRow icon={<FolderOpen className="size-3.5" />} label="Proyecto">
          {byProject.map(({ projectId, name, count }) => {
            const active = filters.projectId === projectId;
            return (
              <FilterChip
                key={projectId}
                active={active}
                // Selección única: volver a pulsar el activo lo quita.
                onClick={() => setProject(active ? null : projectId)}
                count={count}
              >
                {/* Un proyecto borrado llega con `name: ''` (§3.36): sigue contando, así que se
                    pinta con un rótulo honesto en vez de un chip sin texto. */}
                {name.trim() || 'Proyecto eliminado'}
              </FilterChip>
            );
          })}
        </FilterRow>
      )}

      {(filters.taskId || hasContentFilters) && (
        <div className="flex flex-wrap items-center gap-2">
          {filters.taskId && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-container py-1 pl-3 pr-1 text-xs font-medium text-on-primary-container">
              <span className="max-w-56 truncate">{taskLabel ?? 'Tarea seleccionada'}</span>
              <button
                type="button"
                onClick={() => setTask(null)}
                aria-label="Quitar el filtro de tarea"
                className="flex size-5 items-center justify-center rounded-full transition-colors hover:bg-on-primary-container/10"
              >
                <X className="size-3" />
              </button>
            </span>
          )}
          {hasContentFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-on-surface-variant"
              onClick={clearAll}
            >
              Quitar filtros
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

interface FilterRowProps {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}

/** Una fila de chips con su rótulo. El rótulo es texto real (lo lee un lector de pantalla). */
function FilterRow({ icon, label, children }: FilterRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-0.5 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
        {icon}
        {label}
      </span>
      {children}
    </div>
  );
}

interface FilterChipProps {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}

/** Chip de filtro con su contador. `aria-pressed` comunica el estado (es un toggle). */
function FilterChip({ active, onClick, count, children }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
        active
          ? 'border-secondary bg-secondary-container text-on-secondary-container'
          : 'border-outline-variant/60 text-on-surface-variant hover:bg-surface-container-low',
      )}
    >
      {children}
      <span className={cn('tabular-nums', active ? 'opacity-80' : 'opacity-60')}>{count}</span>
    </button>
  );
}
