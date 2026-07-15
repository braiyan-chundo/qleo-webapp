import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  notificationsService,
  type Notification,
  type NotificationListParams,
} from '../services/notifications.service';

/**
 * Hooks de datos del feature Notificaciones (QL-13, §3.10). Toda la interacción con la API
 * pasa por aquí. El MVP usa **polling** para el badge de no leídas.
 */

/** Claves de query del feature. Centralizadas para invalidación consistente. */
export const notificationKeys = {
  all: ['notifications'] as const,
  lists: () => [...notificationKeys.all, 'list'] as const,
  list: (params: NotificationListParams) =>
    [...notificationKeys.lists(), params] as const,
  unreadCount: () => [...notificationKeys.all, 'unread-count'] as const,
};

/** Intervalo de sondeo del badge (§3.10 sugiere 30–60 s). */
const UNREAD_POLL_MS = 45_000;

/** Intervalo de sondeo de la LISTA/bandeja (§3.10 = polling; el badge no basta para verlas llegar). */
const LIST_POLL_MS = 30_000;

/**
 * Bandeja paginada. Sondea cada ~30 s (§3.10, MVP = polling) y al reenfocar la ventana para
 * que las nuevas notificaciones aparezcan en vivo, no solo el contador del badge.
 */
export function useNotifications(params: NotificationListParams) {
  return useQuery({
    queryKey: notificationKeys.list(params),
    queryFn: () => notificationsService.list(params),
    refetchInterval: LIST_POLL_MS,
    refetchOnWindowFocus: true,
  });
}

/** Cuántas notificaciones recientes muestra el popover de la campana (QL-23). */
export const RECENT_NOTIFICATIONS_LIMIT = 8;

/**
 * Últimas notificaciones para el popover de la campana (QL-23). Reutiliza la lista paginada
 * (primera página, ~8 ítems). Refresca al reenfocar la ventana para acompañar el badge.
 */
export function useRecentNotifications(enabled = true) {
  return useQuery({
    queryKey: notificationKeys.list({ page: 1, limit: RECENT_NOTIFICATIONS_LIMIT }),
    queryFn: () =>
      notificationsService.list({ page: 1, limit: RECENT_NOTIFICATIONS_LIMIT }),
    select: (data) => data.data,
    enabled,
    refetchOnWindowFocus: true,
  });
}

/** Contador de no leídas para el badge. Sondea cada ~45 s y al reenfocar la ventana. */
export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: () => notificationsService.unreadCount(),
    select: (data) => data.count,
    refetchInterval: UNREAD_POLL_MS,
    refetchOnWindowFocus: true,
  });
}

/** Marca una notificación como leída e invalida lista + contador (para bajar el badge). */
export function useMarkRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => notificationsService.markRead(id),
    // Optimista: marca la notificación como leída en todas las listas cacheadas.
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.lists() });
      queryClient.setQueriesData<{ data: Notification[] } | undefined>(
        { queryKey: notificationKeys.lists() },
        (prev) =>
          prev
            ? {
                ...prev,
                data: prev.data.map((n) => (n.id === id ? { ...n, read: true } : n)),
              }
            : prev,
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
      queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
    },
  });
}

/** Marca todas como leídas y refresca lista + contador. */
export function useMarkAllRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationsService.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
      queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
    },
  });
}
