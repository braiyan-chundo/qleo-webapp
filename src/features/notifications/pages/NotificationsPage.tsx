import { useMemo } from 'react';
import { toast } from 'sonner';
import { Bell, CheckCheck, Loader2, SearchX } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { BackButton } from '@/shared/components/BackButton';
import { InfiniteScrollSentinel } from '@/shared/components/InfiniteScrollSentinel';

import {
  useDeleteNotification,
  useMarkAllRead,
  useMarkRead,
  useMarkUnread,
  useNotificationFacets,
  useNotificationsInfinite,
} from '../hooks/use-notifications';
import { useNotificationFilters } from '../hooks/use-notification-filters';
import type { Notification } from '../services/notifications.service';
import { groupNotificationsByDate } from '../lib/notification-groups';
import { NotificationFilters } from '../components/NotificationFilters';
import { NotificationRow } from '../components/NotificationRow';

/**
 * Bandeja de notificaciones (QL-13 §3.10, enriquecida en QL-137 §3.36). Tablón con:
 * pestañas Todas/No leídas, **filtros por tipo y proyecto con contadores** (`/facets`), filtro
 * por tarea, **agrupación por fecha**, acciones por notificación (leer/no leer/eliminar) y
 * **scroll infinito**. Todos los filtros viven en la URL (compartibles, sobreviven al recargo).
 *
 * ⚠️ QL-139: **una acción del usuario = un solo `setParams`**. Toda la escritura de la URL está
 * encapsulada en `useNotificationFilters`, que respeta esa regla; aquí NO se encadenan setters.
 */
export function NotificationsPage() {
  const filtersApi = useNotificationFilters();
  const { filters, params, hasContentFilters, hasAnyFilter, setUnread, setTask, clearAll } =
    filtersApi;

  const { data, isLoading, isError, error, isFetching, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useNotificationsInfinite(params);
  const facets = useNotificationFacets();

  const markRead = useMarkRead();
  const markUnread = useMarkUnread();
  const markAllRead = useMarkAllRead();
  const deleteNotification = useDeleteNotification();

  // Las páginas de la infinite query, aplanadas: el orden `createdAt` desc ya viene del backend.
  const notifications = useMemo<Notification[]>(
    () => data?.pages.flatMap((page) => page.data) ?? [],
    [data],
  );
  const groups = useMemo(() => groupNotificationsByDate(notifications), [notifications]);

  const total = data?.pages[0]?.total ?? 0;
  const unreadTotal = facets.data?.unread ?? 0;

  // No hay facets por tarea (§3.36): el rótulo del chip se deduce de las notis cargadas, que al
  // filtrar por tarea traen todas la misma. Si aún no hay ninguna, el chip cae a texto genérico.
  const taskLabel = useMemo(() => {
    if (!filters.taskId) return undefined;
    return notifications.find((n) => n.task?.id === filters.taskId)?.task?.title;
  }, [filters.taskId, notifications]);

  const handleMarkAll = () => {
    markAllRead.mutate(undefined, {
      onSuccess: (res) => {
        toast.success(
          res.modified > 0
            ? `${res.modified} notificación(es) marcadas como leídas`
            : 'No había notificaciones sin leer',
        );
      },
      onError: () => toast.error('No se pudieron marcar como leídas'),
    });
  };

  const handleDelete = (id: string) => {
    deleteNotification.mutate(id, {
      onSuccess: () => toast.success('Notificación eliminada'),
      onError: () => toast.error('No se pudo eliminar la notificación'),
    });
  };

  const handleMarkUnread = (id: string) => {
    markUnread.mutate(id, {
      onError: () => toast.error('No se pudo marcar como no leída'),
    });
  };

  const deletingId = deleteNotification.isPending ? deleteNotification.variables : undefined;

  return (
    <div className="p-4 md:p-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <BackButton fallback={{ to: '/', label: 'Inicio' }} />
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary-container text-on-primary-container">
            <Bell className="size-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-3xl font-bold text-on-surface">Notificaciones</h1>
            <p className="mt-1 text-sm text-on-surface-variant">
              Menciones y avisos de tus tareas
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-10"
          onClick={handleMarkAll}
          disabled={markAllRead.isPending || unreadTotal === 0}
        >
          {markAllRead.isPending ? <Loader2 className="animate-spin" /> : <CheckCheck />}
          Marcar todas como leídas
        </Button>
      </header>

      <div className="max-w-3xl">
        <div className="flex items-center gap-2">
          <FilterTab active={!filters.unread} onClick={() => setUnread(false)}>
            Todas
          </FilterTab>
          <FilterTab active={filters.unread} onClick={() => setUnread(true)}>
            No leídas
            {unreadTotal > 0 && (
              <span className="ml-1.5 tabular-nums opacity-70">{unreadTotal}</span>
            )}
          </FilterTab>
          {isFetching && !isLoading && !isFetchingNextPage && (
            <Loader2 className="ml-auto size-4 animate-spin text-on-surface-variant" />
          )}
        </div>

        <NotificationFilters
          api={filtersApi}
          facets={facets.data}
          isLoading={facets.isLoading}
          taskLabel={taskLabel}
        />

        <div className="mt-4">
          {isLoading && (
            <ul className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <li key={i}>
                  <Skeleton className="h-16 w-full rounded-lg" />
                </li>
              ))}
            </ul>
          )}

          {isError && (
            <p className="rounded-lg border border-error/20 bg-error-container px-4 py-3 text-sm font-medium text-on-error-container">
              {error instanceof Error
                ? error.message
                : 'No se pudieron cargar las notificaciones'}
            </p>
          )}

          {!isLoading && !isError && notifications.length === 0 && (
            <EmptyState
              filtered={hasAnyFilter}
              unreadOnly={filters.unread}
              hasContentFilters={hasContentFilters}
              onClear={clearAll}
            />
          )}

          {!isLoading && !isError && notifications.length > 0 && (
            <>
              {groups.map((group) => (
                <section key={group.label} className="mb-4 last:mb-0">
                  {/* Cabecera pegajosa: al scrollear una bandeja larga, el tramo en el que
                      estás sigue visible. */}
                  <h2 className="sticky top-0 z-10 bg-surface/95 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant backdrop-blur-sm">
                    {group.label}
                  </h2>
                  <ul className="space-y-2">
                    {group.items.map((notification) => (
                      <NotificationRow
                        key={notification.id}
                        notification={notification}
                        onMarkRead={(id) => markRead.mutate(id)}
                        onMarkUnread={handleMarkUnread}
                        onDelete={handleDelete}
                        onFilterByTask={
                          filters.taskId === null ? (id) => setTask(id) : undefined
                        }
                        deleting={deletingId === notification.id}
                      />
                    ))}
                  </ul>
                </section>
              ))}

              <InfiniteScrollSentinel
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                onLoadMore={fetchNextPage}
              />

              {!hasNextPage && total > 0 && (
                <p className="py-3 text-center text-xs text-on-surface-variant">
                  {total === 1 ? '1 notificación' : `${total} notificaciones`}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface FilterTabProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function FilterTab({ active, onClick, children }: FilterTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full px-3 py-1 text-sm font-medium transition-colors',
        active
          ? 'bg-secondary-container text-on-secondary-container'
          : 'text-on-surface-variant hover:bg-surface-container-low',
      )}
    >
      {children}
    </button>
  );
}

interface EmptyStateProps {
  filtered: boolean;
  unreadOnly: boolean;
  hasContentFilters: boolean;
  onClear: () => void;
}

/**
 * Estado vacío. Distingue **"no tienes notificaciones"** de **"no hay ninguna que cumpla estos
 * filtros"**: son cosas distintas y confundirlas hace pensar que la bandeja está rota. Cuando
 * hay filtros de contenido, además ofrece la salida (quitarlos).
 */
function EmptyState({ filtered, unreadOnly, hasContentFilters, onClear }: EmptyStateProps) {
  const Icon = hasContentFilters ? SearchX : Bell;

  const { title, hint } = (() => {
    if (hasContentFilters) {
      return {
        title: 'No hay notificaciones con estos filtros',
        hint: unreadOnly
          ? 'Ninguna sin leer coincide. Prueba con "Todas" o quita algún filtro.'
          : 'Prueba a quitar algún filtro para ver más.',
      };
    }
    if (unreadOnly) {
      return { title: 'Estás al día', hint: 'No tienes notificaciones sin leer.' };
    }
    return {
      title: 'No tienes notificaciones',
      hint: 'Aquí verás cuando te mencionen en una tarea.',
    };
  })();

  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-outline-variant/50 bg-surface-container-lowest px-6 py-12 text-center">
      <Icon className="size-8 text-on-surface-variant/60" aria-hidden />
      <p className="text-sm font-medium text-on-surface">{title}</p>
      <p className="text-xs text-on-surface-variant">{hint}</p>
      {filtered && hasContentFilters && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2 h-8"
          onClick={onClear}
        >
          Quitar filtros
        </Button>
      )}
    </div>
  );
}
