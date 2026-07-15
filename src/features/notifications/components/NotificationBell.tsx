import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import {
  useMarkAllRead,
  useMarkRead,
  useRecentNotifications,
  useUnreadCount,
} from '../hooks/use-notifications';
import type { Notification } from '../services/notifications.service';
import { notificationText, timeAgo } from '../lib/notification-text';
import { resolveNotificationHref } from '../lib/notification-nav';
import { NotificationAvatar } from './NotificationAvatar';

/**
 * Campana de notificaciones del topbar (QL-13/QL-23). Muestra un badge numérico de no leídas
 * (con polling vía `useUnreadCount`) y, al abrirse, un Popover con las últimas notificaciones:
 * cabecera + "marcar todas", lista con estado no-leído y fecha relativa, estado vacío/loading,
 * y un pie para ir a la bandeja completa. Al clicar una fila se marca leída y se navega a su tarea.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data: count = 0 } = useUnreadCount();
  const recent = useRecentNotifications(open);
  const markAllRead = useMarkAllRead();

  const hasUnread = count > 0;
  const label = count > 9 ? '9+' : String(count);

  const notifications = recent.data ?? [];

  const handleMarkAll = () => {
    markAllRead.mutate(undefined, {
      onError: () => toast.error('No se pudieron marcar como leídas'),
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={
            hasUnread ? `Notificaciones, ${count} sin leer` : 'Notificaciones'
          }
          className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low transition-colors relative"
        >
          <Bell className="w-5 h-5" />
          {hasUnread && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 flex items-center justify-center rounded-full bg-error text-on-error text-[10px] font-bold leading-none tabular-nums">
              {label}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-[22rem] max-w-[calc(100vw-1rem)] gap-0 p-0"
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between gap-2 border-b border-outline-variant/30 px-4 py-3">
          <span className="font-heading text-sm font-bold text-on-surface">
            Notificaciones
          </span>
          {hasUnread && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs text-primary"
              onClick={handleMarkAll}
              disabled={markAllRead.isPending}
            >
              {markAllRead.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CheckCheck className="size-3.5" />
              )}
              Marcar todas
            </Button>
          )}
        </div>

        {/* Lista */}
        <div className="max-h-96 overflow-y-auto">
          {recent.isLoading && (
            <ul className="space-y-1 p-2">
              {[0, 1, 2, 3].map((i) => (
                <li key={i}>
                  <Skeleton className="h-14 w-full rounded-lg" />
                </li>
              ))}
            </ul>
          )}

          {!recent.isLoading && recent.isError && (
            <p className="px-4 py-8 text-center text-sm text-on-surface-variant">
              No se pudieron cargar las notificaciones
            </p>
          )}

          {!recent.isLoading && !recent.isError && notifications.length === 0 && (
            <div className="flex flex-col items-center gap-1.5 px-6 py-10 text-center">
              <Bell className="size-7 text-on-surface-variant/60" aria-hidden />
              <p className="text-sm font-medium text-on-surface">Sin notificaciones</p>
              <p className="text-xs text-on-surface-variant">
                Aquí verás cuando te mencionen en una tarea.
              </p>
            </div>
          )}

          {!recent.isLoading && !recent.isError && notifications.length > 0 && (
            <ul className="p-1.5">
              {notifications.map((notification) => (
                <NotificationPopoverRow
                  key={notification.id}
                  notification={notification}
                  onNavigated={() => setOpen(false)}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Pie */}
        <div className="border-t border-outline-variant/30 p-2">
          <GoToInboxButton onNavigated={() => setOpen(false)} />
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface GoToInboxButtonProps {
  onNavigated: () => void;
}

function GoToInboxButton({ onNavigated }: GoToInboxButtonProps) {
  const navigate = useNavigate();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="w-full justify-center text-sm font-medium text-primary"
      onClick={() => {
        navigate('/notifications');
        onNavigated();
      }}
    >
      Ir a notificaciones
    </Button>
  );
}

interface NotificationPopoverRowProps {
  notification: Notification;
  onNavigated: () => void;
}

/**
 * Fila del popover. Al clicar: marca leída (optimista) y navega según el tipo (§3.10):
 * `PROJECT_MEMBER_ADDED` va directo al proyecto; las notis de tarea resuelven su proyecto con
 * `tasksService.getById` y abren la tarea. Cierra el popover. Si no se resuelve, la
 * notificación igual queda marcada como leída.
 */
function NotificationPopoverRow({
  notification,
  onNavigated,
}: NotificationPopoverRowProps) {
  const navigate = useNavigate();
  const markRead = useMarkRead();
  const [resolving, setResolving] = useState(false);

  const handleClick = async () => {
    if (resolving) return;
    if (!notification.read) markRead.mutate(notification.id);
    setResolving(true);
    try {
      const href = await resolveNotificationHref(notification);
      if (href) navigate(href);
      onNavigated();
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
          'flex w-full items-start gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors',
          notification.read
            ? 'hover:bg-surface-container-low'
            : 'bg-surface-container-low/60 hover:bg-surface-container-low',
        )}
      >
        <NotificationAvatar
          actor={notification.actor}
          className="mt-0.5 shrink-0"
        />

        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm text-on-surface">
            {notificationText(notification)}
          </p>
          <p className="mt-0.5 text-xs text-on-surface-variant">
            {timeAgo(notification.createdAt)}
          </p>
        </div>

        {resolving ? (
          <Loader2 className="mt-1 size-3.5 shrink-0 animate-spin text-on-surface-variant" />
        ) : (
          !notification.read && (
            <span
              className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
              aria-hidden
            />
          )
        )}
      </button>
    </li>
  );
}
