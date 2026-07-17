import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Bell, CheckCheck, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  useQueryParamNumber,
  useQueryParams,
  useQueryParamState,
} from '@/shared/hooks/use-query-param-state';

import {
  useMarkAllRead,
  useMarkRead,
  useNotifications,
} from '../hooks/use-notifications';
import type { Notification } from '../services/notifications.service';
import { notificationText, timeAgo } from '../lib/notification-text';
import { resolveNotificationHref } from '../lib/notification-nav';
import { NotificationAvatar } from '../components/NotificationAvatar';

const PAGE_SIZE = 12;

type Filter = 'all' | 'unread';

/**
 * Bandeja de notificaciones (QL-13, §3.10). Lista paginada con filtro Todas/No leídas,
 * "marcar todas como leídas", y navegación de una notificación → tarea (resolviendo el
 * proyecto vía `tasksService.getById`). MVP: polling del badge en la campana del topbar.
 */
export function NotificationsPage() {
  // Filtro + paginación persistidos en la URL (params: `estado`, `page`).
  const [filter] = useQueryParamState<Filter>('estado', 'all');
  const [page, setPage] = useQueryParamNumber('page', 1);
  const setParams = useQueryParams();

  const params = useMemo(
    () => ({ page, limit: PAGE_SIZE, unread: filter === 'unread' }),
    [page, filter],
  );

  const { data, isLoading, isError, error, isFetching } = useNotifications(params);
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const notifications = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /**
   * Cambia de pestaña y vuelve a la página 1 en **una sola** actualización de la URL (QL-139).
   * Antes eran dos setters (`setFilter` + `setPage`) y el segundo pisaba al primero: ambos
   * computaban desde la URL del render actual, así que `setPage(1)` navegaba con unos params
   * que aún no tenían `estado` → la pestaña "No leídas" nunca se activaba. Ver `useQueryParams`.
   */
  const changeFilter = (next: Filter) => {
    setParams({
      // `null` = quitar el param, que es el default de cada uno ('all' y página 1).
      estado: next === 'all' ? null : next,
      page: null,
    });
  };

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

  return (
    <div className="p-4 md:p-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
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
          disabled={markAllRead.isPending || total === 0}
        >
          {markAllRead.isPending ? <Loader2 className="animate-spin" /> : <CheckCheck />}
          Marcar todas como leídas
        </Button>
      </header>

      <div className="max-w-3xl">
      <div className="flex items-center gap-2">
        <FilterTab active={filter === 'all'} onClick={() => changeFilter('all')}>
          Todas
        </FilterTab>
        <FilterTab active={filter === 'unread'} onClick={() => changeFilter('unread')}>
          No leídas
        </FilterTab>
        {isFetching && !isLoading && (
          <Loader2 className="ml-auto size-4 animate-spin text-on-surface-variant" />
        )}
      </div>

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
            {error instanceof Error ? error.message : 'No se pudieron cargar las notificaciones'}
          </p>
        )}

        {!isLoading && !isError && notifications.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-outline-variant/50 bg-surface-container-lowest px-6 py-12 text-center">
            <Bell className="size-8 text-on-surface-variant/60" />
            <p className="text-sm font-medium text-on-surface">No tienes notificaciones</p>
            <p className="text-xs text-on-surface-variant">
              {filter === 'unread'
                ? 'Estás al día: nada sin leer.'
                : 'Aquí verás cuando te mencionen en una tarea.'}
            </p>
          </div>
        )}

        {!isLoading && !isError && notifications.length > 0 && (
          <ul className="space-y-2">
            {notifications.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                onMarkRead={(id) => markRead.mutate(id)}
              />
            ))}
          </ul>
        )}
      </div>

      {!isError && totalPages > 1 && (
        <div className="mt-5 flex items-center justify-between">
          <span className="text-xs text-on-surface-variant">
            Página {page} de {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isFetching}
              aria-label="Página anterior"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isFetching}
              aria-label="Página siguiente"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
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

interface NotificationRowProps {
  notification: Notification;
  onMarkRead: (id: string) => void;
}

/**
 * Fila de la bandeja. Al hacer clic: marca leída (optimista, vía el mutation del padre) y
 * navega según el tipo (§3.10): `PROJECT_MEMBER_ADDED` va directo al proyecto; las notis de
 * tarea resuelven su proyecto con `tasksService.getById`. Si la resolución falla, igual queda
 * marcada como leída.
 */
function NotificationRow({ notification, onMarkRead }: NotificationRowProps) {
  const navigate = useNavigate();
  const [resolving, setResolving] = useState(false);

  const handleClick = async () => {
    if (resolving) return;
    if (!notification.read) onMarkRead(notification.id);
    setResolving(true);
    try {
      const href = await resolveNotificationHref(notification);
      if (href) navigate(href);
    } catch {
      toast.error('No se pudo abrir la notificación (puede haber sido eliminada)');
    } finally {
      setResolving(false);
    }
  };

  return (
    <li>
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          'flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors',
          notification.read
            ? 'border-outline-variant/30 bg-surface-container-lowest hover:bg-surface-container-low'
            : 'border-primary/20 bg-surface-container-low hover:bg-surface-container',
        )}
      >
        <NotificationAvatar
          actor={notification.actor}
          className="mt-0.5 shrink-0"
        />

        <div className="min-w-0 flex-1">
          <p className="text-sm text-on-surface">{notificationText(notification)}</p>
          <p className="mt-0.5 text-xs text-on-surface-variant">
            {timeAgo(notification.createdAt)}
          </p>
        </div>

        {resolving ? (
          <Loader2 className="mt-1 size-3.5 shrink-0 animate-spin text-on-surface-variant" />
        ) : (
          !notification.read && (
            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden />
          )
        )}
      </button>
    </li>
  );
}
