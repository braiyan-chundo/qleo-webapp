import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/store/auth.store';
import {
  attachmentsService,
  type Attachment,
} from '@/features/attachments/services/attachments.service';

import { wallService } from '../services/wall.service';
import {
  buildOptimisticMessage,
  mergeMessages,
  newestConfirmedId,
  oldestConfirmedId,
  reconcileOptimistic,
  removeOptimistic,
  type WallFeedItem,
} from '../lib/wall-feed';
import { notifyWallError } from '../lib/wall-errors';
import type { WallAuthor, WallMessage, WallReplyPreview } from '../types/wall.types';

/**
 * Hooks de datos del Muro Corporativo (QL-89, §3.25). Todo el estado del servidor vive en
 * la caché de TanStack Query; aquí solo hay banderas de UI (`hasMoreOlder`). El tiempo real
 * es por **polling** con cursor `after` (WebSockets después).
 */

/** Claves de query del feature, centralizadas para invalidación consistente. */
export const wallKeys = {
  all: ['wall'] as const,
  feed: () => [...wallKeys.all, 'feed'] as const,
  poll: () => [...wallKeys.all, 'poll'] as const,
  unreadCount: () => [...wallKeys.all, 'unread-count'] as const,
  pinned: () => [...wallKeys.all, 'pinned'] as const,
  presence: () => [...wallKeys.all, 'presence'] as const,
  /** (QL-119) Prefijo de las queries del buscador; el término va como último segmento. */
  search: () => [...wallKeys.all, 'search'] as const,
};

/** Tamaño de página de la carga inicial y del historial (`before`). Máx del backend: 50. */
const PAGE_SIZE = 30;
/** Cadencia del polling de novedades (§3.25 sugiere 10–15 s). */
const POLL_MS = 12_000;
/** Cadencia del badge de no leídos (§3.25 sugiere ~45 s, igual que la campana). */
const UNREAD_POLL_MS = 45_000;

interface WallFeed {
  messages: WallFeedItem[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  /** Pide una página de historial (`before=<oldestCursor>`). No-op si no hay más pasado. */
  loadOlder: () => void;
  isLoadingOlder: boolean;
  hasMoreOlder: boolean;
  /**
   * (QL-119) Salta a un mensaje: **reemplaza** el feed por la ventana `around` centrada en él.
   * El scroll+highlight lo dispara el llamador (`WallView`) al resolver (`onSuccess`).
   */
  jumpToMessage: (
    messageId: string,
    options?: { onSuccess?: () => void; onError?: (error: Error) => void },
  ) => void;
  isJumping: boolean;
}

/**
 * Feed del muro: carga inicial (`limit=30`), historial hacia atrás (`before`) y **polling**
 * de novedades (`after`) — este último **solo cuando `active`** (pestaña Muro) y la pestaña
 * del navegador está **visible** (TanStack pausa `refetchInterval` en segundo plano).
 *
 * El feed se guarda **ascendente** (más antiguo → más nuevo) para pintarse como un chat.
 */
export function useWallFeed(active: boolean): WallFeed {
  const queryClient = useQueryClient();
  const [hasMoreOlder, setHasMoreOlder] = useState(true);

  // Carga inicial. Actualizamos el feed a mano (historial + polling + optimista), por eso
  // `staleTime: Infinity` y sin refetch por foco: no queremos que Query lo recargue solo.
  const feedQuery = useQuery({
    queryKey: wallKeys.feed(),
    queryFn: async () => {
      const page = await wallService.list({ limit: PAGE_SIZE });
      // Si la primera página no llena el tamaño, no hay historial anterior que pedir.
      setHasMoreOlder(page.length >= PAGE_SIZE);
      return mergeMessages([], page);
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  // Historial: mutación (nos da `isPending`/`error` sin manejar `loading` a mano).
  const olderMutation = useMutation({
    mutationFn: () => {
      const feed = queryClient.getQueryData<WallFeedItem[]>(wallKeys.feed()) ?? [];
      const cursor = oldestConfirmedId(feed);
      if (!cursor) return Promise.resolve([]);
      return wallService.list({ before: cursor, limit: PAGE_SIZE });
    },
    onSuccess: (older) => {
      if (older.length < PAGE_SIZE) setHasMoreOlder(false);
      if (older.length > 0) {
        queryClient.setQueryData<WallFeedItem[]>(wallKeys.feed(), (prev) =>
          mergeMessages(prev ?? [], older),
        );
      }
    },
  });

  const loadOlder = useCallback(() => {
    if (olderMutation.isPending || !hasMoreOlder) return;
    olderMutation.mutate();
  }, [olderMutation, hasMoreOlder]);

  // (QL-119) Salto a un mensaje: pide la ventana `around` y **reemplaza** el feed por ella (sin
  // huecos → los cursores `before`/`after` siguen siendo correctos desde la nueva ventana). Se
  // asume que puede haber historial anterior (`hasMoreOlder = true`); `loadOlder` descubrirá el
  // fin cuando una página vuelva incompleta. El polling `after` retoma el avance hacia el presente.
  const jumpMutation = useMutation({
    mutationFn: (messageId: string) => wallService.around(messageId, PAGE_SIZE),
    onSuccess: (window) => {
      setHasMoreOlder(true);
      queryClient.setQueryData<WallFeedItem[]>(wallKeys.feed(), () => mergeMessages([], window));
    },
  });

  const jumpToMessage = useCallback(
    (
      messageId: string,
      options?: { onSuccess?: () => void; onError?: (error: Error) => void },
    ) => {
      jumpMutation.mutate(messageId, options);
    },
    [jumpMutation],
  );

  // Polling de novedades. `enabled` gatea por pestaña Muro activa; `refetchInterval` se
  // pausa solo cuando el documento no está visible (comportamiento por defecto de Query).
  useQuery({
    queryKey: wallKeys.poll(),
    queryFn: async () => {
      const feed = queryClient.getQueryData<WallFeedItem[]>(wallKeys.feed()) ?? [];
      const cursor = newestConfirmedId(feed);
      if (!cursor) return 0;
      const fresh = await wallService.list({ after: cursor, limit: PAGE_SIZE });
      if (fresh.length > 0) {
        queryClient.setQueryData<WallFeedItem[]>(wallKeys.feed(), (prev) =>
          mergeMessages(prev ?? [], fresh),
        );
      }
      return fresh.length;
    },
    enabled: active && feedQuery.isSuccess,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    staleTime: 0,
    gcTime: 0,
  });

  return {
    messages: feedQuery.data ?? [],
    isLoading: feedQuery.isLoading,
    isError: feedQuery.isError,
    error: feedQuery.error,
    refetch: () => void feedQuery.refetch(),
    loadOlder,
    isLoadingOlder: olderMutation.isPending,
    hasMoreOlder,
    jumpToMessage,
    isJumping: jumpMutation.isPending,
  };
}

/** Payload de envío (QL-90): texto + menciones (userIds) + adjuntos ya subidos. */
export interface SendWallMessageInput {
  /** Texto ya recortado; puede ir vacío si hay ≥1 adjunto (§3.25.2). */
  body: string;
  /** userIds mencionados válidos (resueltos vía `/users/directory`). */
  mentions: string[];
  /** Adjuntos ya subidos con `useUploadWallAttachment` (para `attachmentIds` + optimista). */
  attachments: Attachment[];
  /** (QL-103) id del mensaje citado al responder, o `undefined` si no es una respuesta. */
  replyTo?: string;
  /** (QL-103) cita reducida del mensaje respondido, para pintar el quote del optimista. */
  replyPreview?: WallReplyPreview | null;
}

/**
 * Envía un mensaje al muro con **actualización optimista**: aparece al instante (con sus
 * menciones y adjuntos), se reconcilia con el `WallMessage` expandido que devuelve el POST
 * y se revierte en error. El backend acepta body vacío si hay ≥1 adjunto (§3.25.2).
 */
export function useSendWallMessage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: ({ body, mentions, attachments, replyTo }: SendWallMessageInput) =>
      wallService.create({
        body: body.trim() || undefined,
        mentions: mentions.length ? mentions : undefined,
        attachmentIds: attachments.length ? attachments.map((a) => a.id) : undefined,
        replyTo: replyTo || undefined,
      }),
    onMutate: async ({ body, mentions, attachments, replyPreview }) => {
      await queryClient.cancelQueries({ queryKey: wallKeys.feed() });
      const author: WallAuthor = {
        id: user?.id ?? 'me',
        name: user?.name ?? 'Yo',
        avatarDownloadUrl: user?.avatarDownloadUrl ?? null,
      };
      const optimistic = buildOptimisticMessage({
        body: body.trim(),
        author,
        mentions,
        attachments,
        replyTo: replyPreview ?? null,
      });
      queryClient.setQueryData<WallFeedItem[]>(wallKeys.feed(), (prev) => [
        ...(prev ?? []),
        optimistic,
      ]);
      return { tempId: optimistic.id };
    },
    onSuccess: (confirmed, _input, context) => {
      queryClient.setQueryData<WallFeedItem[]>(wallKeys.feed(), (prev) =>
        reconcileOptimistic(prev ?? [], context.tempId, confirmed),
      );
    },
    onError: (error, _input, context) => {
      if (context) {
        queryClient.setQueryData<WallFeedItem[]>(wallKeys.feed(), (prev) =>
          removeOptimistic(prev ?? [], context.tempId),
        );
      }
      notifyWallError(error, 'No se pudo enviar el mensaje');
    },
  });
}

/**
 * Sube **un** adjunto del muro (subida previa, §3.25.2) para adjuntarlo al mensaje que se
 * está redactando. Es una acción puntual (no una lista cacheable), por eso una mutación sin
 * invalidación: el composer guarda el `Attachment` devuelto en su estado local hasta enviar.
 */
export function useUploadWallAttachment() {
  return useMutation({
    // (QL-104) Para una nota de voz se pasa `durationSec`; para el resto de adjuntos se omite.
    mutationFn: ({ file, durationSec }: { file: File; durationSec?: number }) =>
      wallService.uploadAttachment(file, durationSec),
  });
}

/**
 * Borra un adjunto del muro **aún no vinculado** (huérfano de la subida previa) al quitarlo
 * del composer antes de enviar (§3.25.2). Reusa el `DELETE /attachments/:id` genérico; el
 * uploader puede borrar su propio adjunto huérfano. Best-effort (ignora fallos de red).
 */
export function useRemoveWallAttachment() {
  return useMutation({
    mutationFn: (id: string) => attachmentsService.remove(id),
  });
}

/** Payload de edición de un mensaje del muro (QL-90). `body` obligatorio; `mentions` = set completo. */
export interface EditWallMessageInput {
  id: string;
  body: string;
  mentions: string[];
}

/**
 * Edita un mensaje propio (`PATCH`, marca "editado"). Al éxito reemplaza el mensaje en la
 * caché del feed por el devuelto (mismo `id` → `mergeMessages` conserva su posición).
 */
export function useEditWallMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body, mentions }: EditWallMessageInput) =>
      wallService.update(id, { body: body.trim(), mentions }),
    onSuccess: (updated) => {
      queryClient.setQueryData<WallFeedItem[]>(wallKeys.feed(), (prev) =>
        mergeMessages(prev ?? [], [updated]),
      );
    },
  });
}

/**
 * Borra (soft-delete) un mensaje. **(QL-102)** SOLO el autor puede borrarlo (ni ADMIN puede
 * borrar ajenos); un no-autor recibe `403 WALL_MESSAGE_NOT_AUTHOR` (lo traduce `notifyWallError`
 * en el llamador). El `DELETE` devuelve el mensaje **ya como lápida** (`deleted:true`); al éxito
 * NO lo quitamos del feed: lo **reemplazamos in-place** por esa lápida (mismo `id` →
 * `mergeMessages` conserva su posición), de modo que queda "Este mensaje fue eliminado".
 */
export function useDeleteWallMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => wallService.remove(id),
    onSuccess: (tombstone) => {
      queryClient.setQueryData<WallFeedItem[]>(wallKeys.feed(), (prev) =>
        mergeMessages(prev ?? [], [tombstone]),
      );
    },
  });
}

/** Payload de reacción a un mensaje del muro (QL-147, §3.42): el emoji a alternar. */
export interface ReactToWallMessageInput {
  id: string;
  emoji: string;
}

/**
 * (QL-147, §3.42) Alterna la reacción propia a un mensaje del muro (`POST .../reactions`): es un
 * **toggle con reemplazo** (mismo emoji la quita, otro la reemplaza; una por usuario) y devuelve el
 * mensaje con las `reactions` recalculadas.
 *
 * **Caché del feed gestionada a mano:** el feed vive en una única entrada (`wallKeys.feed()`) con
 * `staleTime: Infinity` (historial + ventana `around` + polling), así que al éxito **reemplazamos
 * SOLO ese mensaje** por el devuelto vía `mergeMessages` (mismo `id` → conserva su posición) y
 * **NO invalidamos el feed entero** (eso descartaría el historial/ventana ya cargados y provocaría
 * un salto de scroll). Las reacciones de OTROS a mensajes ya cargados no se refrescan solas —el
 * poll solo trae mensajes nuevos—: limitación conocida y aceptable del MVP.
 */
export function useReactToWallMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, emoji }: ReactToWallMessageInput) => wallService.react(id, emoji),
    onSuccess: (updated) => {
      queryClient.setQueryData<WallFeedItem[]>(wallKeys.feed(), (prev) =>
        mergeMessages(prev ?? [], [updated]),
      );
    },
  });
}

/**
 * Conteo de mensajes no leídos del muro (QL-91, §3.25) para el badge del nav. Sondea cada
 * ~45 s (misma cadencia que la campana) y al reenfocar la ventana. Devuelve `{ count }`;
 * la query se invalida al marcar leído (`useMarkWallRead`) para que el badge caiga a 0.
 */
export function useWallUnreadCount() {
  const token = useAuthStore((s) => s.accessToken);

  const query = useQuery({
    queryKey: wallKeys.unreadCount(),
    queryFn: () => wallService.unreadCount(),
    select: (data) => data.count,
    enabled: !!token,
    refetchInterval: UNREAD_POLL_MS,
    refetchOnWindowFocus: true,
  });

  return { count: query.data ?? 0 };
}

/**
 * Marca el muro como leído (QL-91, `POST /wall/read`). Al éxito invalida el conteo de no
 * leídos → el badge del nav cae a 0. Se dispara al **abrir** el muro (ver `WallView`), no
 * en cada render ni en cada tick del polling.
 */
export function useMarkWallRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => wallService.markRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: wallKeys.unreadCount() });
    },
  });
}

/** Cadencia de refresco del panel de fijados (QL-93): infrecuente; se invalida tras pin/unpin. */
const PINNED_POLL_MS = 60_000;

/**
 * Lista de mensajes fijados del muro (QL-93, §3.27) para el panel lateral. `GET /wall/pinned`
 * ya devuelve cada mensaje **expandido** (autor + adjuntos + `pinnedBy`), orden `pinnedAt`
 * desc. Se refresca en un polling suave y se invalida tras un `pin`/`unpin` propio.
 */
export function useWallPinned() {
  const token = useAuthStore((s) => s.accessToken);

  return useQuery({
    queryKey: wallKeys.pinned(),
    queryFn: () => wallService.pinned(),
    enabled: !!token,
    refetchInterval: PINNED_POLL_MS,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });
}

/**
 * Reconcilia en la caché del feed el `WallMessage` expandido que devuelve `pin`/`unpin` (trae
 * `pinnedAt`/`pinnedBy` ya actualizados) e invalida el panel de fijados. Al ser el mismo `id`,
 * `mergeMessages` conserva la posición del mensaje en el hilo (solo cambia su estado de fijado).
 */
function applyPinResult(queryClient: ReturnType<typeof useQueryClient>, updated: WallMessage) {
  queryClient.setQueryData<WallFeedItem[]>(wallKeys.feed(), (prev) =>
    mergeMessages(prev ?? [], [updated]),
  );
  queryClient.invalidateQueries({ queryKey: wallKeys.pinned() });
}

/**
 * Fija un mensaje (QL-93, `POST .../pin`; **solo ADMIN**). El backend rechaza a un MEMBER con
 * 403 (la UI solo muestra la acción a ADMIN). Al éxito actualiza el feed con el mensaje
 * devuelto e invalida `GET /wall/pinned`. Errores → toast (los gestiona el llamador).
 */
export function usePinMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => wallService.pin(id),
    onSuccess: (updated) => applyPinResult(queryClient, updated),
  });
}

/**
 * Desfija un mensaje (QL-93, `POST .../unpin`; **solo ADMIN**). El mensaje devuelto trae
 * `pinnedAt: null`/`pinnedBy: null` → el indicador desaparece del hilo y el panel se refresca.
 */
export function useUnpinMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => wallService.unpin(id),
    onSuccess: (updated) => applyPinResult(queryClient, updated),
  });
}
