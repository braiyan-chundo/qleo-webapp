import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';

import type { Paginated } from '@/shared/types/paginated';

import {
  notificationsService,
  type Notification,
  type NotificationListParams,
} from '../services/notifications.service';

/**
 * Hooks de datos del feature Notificaciones (QL-13 §3.10, QL-137 §3.36). Toda la interacción
 * con la API pasa por aquí. El MVP usa **polling** para el badge de no leídas.
 */

/**
 * Claves de query del feature. Centralizadas para invalidación consistente.
 *
 * ⚠️ `lists()` (paginada, campana) y `feeds()` (scroll infinito, bandeja) son prefijos
 * **hermanos a propósito**: sus cachés tienen formas distintas (`Paginated<T>` vs
 * `InfiniteData<Paginated<T>>`). Si el infinito colgara de `lists()`, cualquier
 * `setQueriesData` sobre ese prefijo (p. ej. el optimista de `useMarkRead`) recibiría un
 * `InfiniteData` esperando un `Paginated` y reventaría (`prev.data` es `undefined`).
 */
export const notificationKeys = {
  all: ['notifications'] as const,
  lists: () => [...notificationKeys.all, 'list'] as const,
  list: (params: NotificationListParams) =>
    [...notificationKeys.lists(), params] as const,
  /** (QL-137) Bandeja con scroll infinito. Caché `InfiniteData`, NO cuelga de `lists()`. */
  feeds: () => [...notificationKeys.all, 'feed'] as const,
  feed: (params: NotificationListParams) =>
    [...notificationKeys.feeds(), params] as const,
  /** (QL-137) Contadores de los filtros. */
  facets: () => [...notificationKeys.all, 'facets'] as const,
  unreadCount: () => [...notificationKeys.all, 'unread-count'] as const,
};

/** Intervalo de sondeo del badge (§3.10 sugiere 30–60 s). */
const UNREAD_POLL_MS = 45_000;

/** Intervalo de sondeo de la LISTA/bandeja (§3.10 = polling; el badge no basta para verlas llegar). */
const LIST_POLL_MS = 30_000;

/** Tamaño de página de la bandeja con scroll infinito (QL-137). */
export const NOTIFICATIONS_PAGE_SIZE = 20;

/**
 * Bandeja con **scroll infinito** (QL-137). `getNextPageParam` se apoya en el `Paginated` del
 * backend: hay siguiente mientras `page * limit < total`. Los filtros van en la clave, así que
 * cambiar de filtro arranca su propia caché desde la página 1 (no hay que resetear nada a mano).
 *
 * Nota: el `refetchInterval` de una infinite query refresca **todas** las páginas cargadas. La
 * bandeja rara vez pasa de 2–3 páginas, así que se mantiene el polling de §3.10.
 */
export function useNotificationsInfinite(
  params: Omit<NotificationListParams, 'page'> = {},
) {
  return useInfiniteQuery({
    queryKey: notificationKeys.feed(params),
    queryFn: ({ pageParam }) =>
      notificationsService.list({
        ...params,
        page: pageParam,
        limit: params.limit ?? NOTIFICATIONS_PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page * last.limit < last.total ? last.page + 1 : undefined,
    refetchInterval: LIST_POLL_MS,
    refetchOnWindowFocus: true,
  });
}

/**
 * Contadores para pintar los filtros con números (QL-137, §3.36). Una sola aggregation en el
 * backend. Se invalida tras cualquier mutación (leer/no leer/eliminar) porque `unread` cambia.
 */
export function useNotificationFacets() {
  return useQuery({
    queryKey: notificationKeys.facets(),
    queryFn: () => notificationsService.facets(),
    staleTime: 15_000,
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

/**
 * Aplica un parche a una notificación en **las dos** cachés (paginada y de scroll infinito).
 * Cada una tiene su forma, por eso son dos `setQueriesData` con tipos distintos.
 */
function patchCachedNotification(
  queryClient: QueryClient,
  id: string,
  patch: Partial<Notification>,
) {
  const apply = (items: Notification[]) =>
    items.map((n) => (n.id === id ? { ...n, ...patch } : n));

  queryClient.setQueriesData<Paginated<Notification>>(
    { queryKey: notificationKeys.lists() },
    (prev) => (prev ? { ...prev, data: apply(prev.data) } : prev),
  );
  queryClient.setQueriesData<InfiniteData<Paginated<Notification>>>(
    { queryKey: notificationKeys.feeds() },
    (prev) =>
      prev
        ? {
            ...prev,
            pages: prev.pages.map((page) => ({ ...page, data: apply(page.data) })),
          }
        : prev,
  );
}

/** Quita una notificación de las dos cachés y ajusta el `total` (QL-137, borrado). */
function removeCachedNotification(queryClient: QueryClient, id: string) {
  const drop = (page: Paginated<Notification>): Paginated<Notification> => {
    const data = page.data.filter((n) => n.id !== id);
    // Si no estaba en esta página, el total no cambia.
    const total = data.length === page.data.length ? page.total : Math.max(0, page.total - 1);
    return { ...page, data, total };
  };

  queryClient.setQueriesData<Paginated<Notification>>(
    { queryKey: notificationKeys.lists() },
    (prev) => (prev ? drop(prev) : prev),
  );
  queryClient.setQueriesData<InfiniteData<Paginated<Notification>>>(
    { queryKey: notificationKeys.feeds() },
    (prev) => (prev ? { ...prev, pages: prev.pages.map(drop) } : prev),
  );
}

/** Invalida todo lo que depende del estado leído/no leído: listas, bandeja, facets y badge. */
function invalidateNotificationViews(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
  queryClient.invalidateQueries({ queryKey: notificationKeys.feeds() });
  queryClient.invalidateQueries({ queryKey: notificationKeys.facets() });
  queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
}

/** Marca una notificación como leída (optimista) e invalida lista + contador + facets. */
export function useMarkRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => notificationsService.markRead(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.lists() });
      await queryClient.cancelQueries({ queryKey: notificationKeys.feeds() });
      patchCachedNotification(queryClient, id, { read: true });
    },
    onSettled: () => invalidateNotificationViews(queryClient),
  });
}

/**
 * (QL-137) Marca una notificación como **NO** leída (inverso exacto de `useMarkRead`). Optimista
 * en ambas cachés; al asentar se invalida todo (el badge y `facets.unread` suben).
 */
export function useMarkUnread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => notificationsService.markUnread(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.lists() });
      await queryClient.cancelQueries({ queryKey: notificationKeys.feeds() });
      patchCachedNotification(queryClient, id, { read: false });
    },
    onSettled: () => invalidateNotificationViews(queryClient),
  });
}

/**
 * (QL-137) Elimina una notificación (borrado físico en el backend). Optimista: la fila
 * desaparece al instante. Si falla, `onSettled` invalida y la lista vuelve a la verdad del
 * servidor (un 404 significa que ya no estaba ⇒ quitarla era lo correcto de todas formas).
 */
export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => notificationsService.remove(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.lists() });
      await queryClient.cancelQueries({ queryKey: notificationKeys.feeds() });
      removeCachedNotification(queryClient, id);
    },
    onSettled: () => invalidateNotificationViews(queryClient),
  });
}

/** Marca todas como leídas y refresca lista + contador + facets. */
export function useMarkAllRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationsService.markAllRead(),
    onSuccess: () => invalidateNotificationViews(queryClient),
  });
}
