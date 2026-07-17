import { api, ApiError } from '@/core/api/fetch-client';
import { useAuthStore } from '@/store/auth.store';
import type { Attachment } from '@/features/attachments/services/attachments.service';

import type {
  CreateWallMessageDto,
  UpdateWallMessageDto,
  WallFeedParams,
  WallMessage,
  WallPresenceCount,
  WallReaction,
  WallReadResult,
  WallReplyPreview,
  WallSearchResult,
  WallUnreadCount,
} from '../types/wall.types';
import type { WallSharedResponse, WallSharedType } from '../types/wall-shared.types';

/**
 * Acceso a datos del Muro Corporativo (QL-86, §3.25). Todo pasa por TanStack Query (ver
 * `hooks/use-wall.ts`); estos métodos devuelven `T` directo (el fetch-client ya desenvuelve
 * `{ success, data }` y maneja el 401 global).
 *
 * **Cursor = `message.id`** (ObjectId): ya ordena por tiempo de creación. `before` carga
 * historial (más antiguos); `after` sondea novedades (más nuevos). Ambos modos devuelven el
 * array **descendente** (más reciente primero) y hasta `limit`.
 */

/**
 * Base URL de la API, replicando la resolución del `fetch-client` para la **subida
 * multipart** de adjuntos del muro (§3.25.2): el `api` fuerza `Content-Type: application/json`,
 * pero en `multipart/form-data` el navegador debe poner el `boundary` él mismo. Mismo patrón
 * que `attachments.service`/`avatar.service`.
 */
const BASE_URL = import.meta.env.VITE_QLEO_API_BASE_URL || '/api';

/** Lee el token de la sesión (Zustand). Fuera de React, por eso `getState()`. */
function authHeader(): Record<string, string> {
  const token = useAuthStore.getState().accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Traduce una respuesta HTTP fallida al mismo `ApiError` del `fetch-client` (por `err.code`). */
async function toApiError(response: Response): Promise<ApiError> {
  const result = await response.json().catch(() => null);
  const message = result?.error?.message || response.statusText || 'Error desconocido';
  const code = result?.error?.code ?? null;
  return new ApiError(message, code, response.status);
}

/** Maneja el 401 global igual que el `fetch-client` (cierra sesión y manda al login). */
function handleUnauthorized(status: number) {
  if (status === 401) {
    useAuthStore.getState().logout();
    window.location.href = '/login';
  }
}

/**
 * Forma **cruda** de un mensaje tal como llega del backend. Los mensajes **eliminados** vienen
 * como "lápida" (§3.25): `body:null`, `attachments/mentions:[]`, `pinnedAt/pinnedBy/editedAt:null`,
 * conservando `id/author/createdAt`. `deleted` puede faltar en respuestas de endpoints que solo
 * devuelven mensajes vivos → se asume `false` al normalizar.
 */
type RawWallMessage = Omit<WallMessage, 'body' | 'deleted' | 'replyTo' | 'reactions'> & {
  body: string | null;
  deleted?: boolean;
  /** Puede faltar en respuestas de endpoints previos a QL-103 → se asume `null` al normalizar. */
  replyTo?: WallReplyPreview | null;
  /** (QL-147) Puede faltar en respuestas de endpoints previos a QL-147 → se asume `[]` al normalizar. */
  reactions?: WallReaction[];
};

/**
 * Normaliza un mensaje crudo al `WallMessage` de la app: `deleted` firme y `body` como `string`.
 * En una lápida fuerza los campos vacíos del contrato (defensivo) para que la UI no dependa de
 * cada uno por separado y baste con `deleted` para decidir el render.
 */
function normalizeWallMessage(raw: RawWallMessage): WallMessage {
  if (raw.deleted) {
    return {
      ...raw,
      deleted: true,
      body: '',
      mentions: [],
      attachments: [],
      editedAt: null,
      pinnedAt: null,
      pinnedBy: null,
      // La lápida no arrastra su cita (QL-103) ni sus reacciones (QL-147): ambos vacíos en un borrado.
      replyTo: null,
      reactions: [],
    };
  }
  return {
    ...raw,
    deleted: false,
    body: raw.body ?? '',
    replyTo: raw.replyTo ?? null,
    reactions: raw.reactions ?? [],
  };
}

function buildQuery(params: WallFeedParams): string {
  const search = new URLSearchParams();
  // `around` (QL-119) prevalece sobre `before`/`after` (misma regla del backend); si viene,
  // ignoramos los cursores para no combinarlos. Si no, `before` prevalece sobre `after`.
  if (params.around) search.set('around', params.around);
  else if (params.before) search.set('before', params.before);
  else if (params.after) search.set('after', params.after);
  if (params.limit != null) search.set('limit', String(params.limit));
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export const wallService = {
  /**
   * Feed descendente (más reciente primero). Ahora **incluye los borrados** como lápida
   * (`deleted:true`); el `normalizeWallMessage` deja `body` como `string` y campos vacíos firmes.
   */
  list: async (params: WallFeedParams = {}): Promise<WallMessage[]> => {
    const page = await api.get<RawWallMessage[]>(`/wall/messages${buildQuery(params)}`);
    return page.map(normalizeWallMessage);
  },

  /**
   * (QL-119) Ventana **centrada** en un mensaje (`?around=<id>`) para el "saltar al mensaje" del
   * buscador: ~limit/2 más nuevos + el propio + ~limit/2 más antiguos, mismo shape y orden que
   * `list` (descendente, normalizado, **incluye lápidas**). El objetivo siempre viene incluido;
   * id inexistente → 404 `WALL_MESSAGE_NOT_FOUND`.
   */
  around: async (messageId: string, limit?: number): Promise<WallMessage[]> => {
    const page = await api.get<RawWallMessage[]>(
      `/wall/messages${buildQuery({ around: messageId, limit })}`,
    );
    return page.map(normalizeWallMessage);
  },

  /**
   * (QL-119) Busca `q` en el cuerpo de los mensajes vivos (`GET /wall/search`). Case-insensitive
   * con `trim`; `<2` chars útiles → el backend devuelve `[]` (para search-as-you-type). Orden
   * descendente (más reciente primero), tope `limit` (default 20, máx 50). Devuelve la forma
   * **mínima** `WallSearchResult` (índice), NO el `WallMessage` completo.
   */
  search: (q: string, limit?: number): Promise<WallSearchResult[]> => {
    const search = new URLSearchParams({ q });
    if (limit != null) search.set('limit', String(limit));
    return api.get<WallSearchResult[]>(`/wall/search?${search.toString()}`);
  },

  /** Crea un mensaje; devuelve el `WallMessage` expandido (para reconciliar el optimista). */
  create: async (dto: CreateWallMessageDto): Promise<WallMessage> => {
    return normalizeWallMessage(await api.post<RawWallMessage>('/wall/messages', dto));
  },

  /** Edita un mensaje propio (`PATCH`, marca `editedAt`). Devuelve el mensaje actualizado. */
  update: async (id: string, dto: UpdateWallMessageDto): Promise<WallMessage> => {
    return normalizeWallMessage(
      await api.patch<RawWallMessage>(`/wall/messages/${id}`, dto),
    );
  },

  /**
   * Borra (soft-delete) un mensaje propio o cualquiera si ADMIN. Devuelve el mensaje **ya en
   * forma de lápida** (`deleted:true`, campos vacíos) para reemplazarlo en la caché in-place.
   */
  remove: async (id: string): Promise<WallMessage> => {
    return normalizeWallMessage(await api.delete<RawWallMessage>(`/wall/messages/${id}`));
  },

  /**
   * Sube **un** adjunto del muro (subida previa, §3.25.2): `multipart/form-data`, campo
   * `file`. Devuelve el `Attachment` (`scope='wall'`, `wallMessageId:null`); su `id` se
   * pasa luego en `attachmentIds` al `create`. `fetch` manual por el multipart.
   *
   * **(QL-104)** Para una **nota de voz** (audio) manda además `durationSec` (entero de
   * segundos) en el mismo `FormData`; el backend lo valida (0..86400) y lo devuelve en el
   * `Attachment.durationSec`. Omítelo para adjuntos que no sean audio.
   */
  uploadAttachment: async (file: File, durationSec?: number): Promise<Attachment> => {
    const formData = new FormData();
    formData.append('file', file);
    if (durationSec != null) formData.append('durationSec', String(durationSec));

    const response = await fetch(`${BASE_URL}/wall/attachments`, {
      method: 'POST',
      headers: authHeader(),
      body: formData,
    });

    if (!response.ok) {
      handleUnauthorized(response.status);
      throw await toApiError(response);
    }

    const result = await response.json().catch(() => null);
    return (result?.data ?? result) as Attachment;
  },

  /** Conteo de no leídos propios (base del badge; QL-91). */
  unreadCount: () => {
    return api.get<WallUnreadCount>('/wall/unread-count');
  },

  /** Marca el muro como leído (upsert `lastReadAt = ahora`; QL-91). Sin body. */
  markRead: () => {
    return api.post<WallReadResult>('/wall/read');
  },

  /**
   * Lista de mensajes fijados (QL-93, §3.27): `WallMessage[]` fijados y no borrados, orden
   * `pinnedAt` desc (lo último fijado primero), tope 50. Cualquier autenticado la lee.
   */
  pinned: async (): Promise<WallMessage[]> => {
    const list = await api.get<RawWallMessage[]>('/wall/pinned');
    return list.map(normalizeWallMessage);
  },

  /**
   * Fija un mensaje (QL-93, §3.27; **solo ADMIN** → el backend responde 403 a un MEMBER).
   * Idempotente. Devuelve el `WallMessage` expandido con `pinnedAt`/`pinnedBy` seteados.
   */
  pin: async (id: string): Promise<WallMessage> => {
    return normalizeWallMessage(await api.post<RawWallMessage>(`/wall/messages/${id}/pin`));
  },

  /**
   * Desfija un mensaje (QL-93, §3.27; **solo ADMIN**). Idempotente. Devuelve el `WallMessage`
   * expandido con `pinnedAt: null`, `pinnedBy: null` → el front lo quita del panel de fijados.
   */
  unpin: async (id: string): Promise<WallMessage> => {
    return normalizeWallMessage(await api.post<RawWallMessage>(`/wall/messages/${id}/unpin`));
  },

  /**
   * (QL-147, §3.42) Alterna la reacción propia a un mensaje (`POST .../reactions`): **toggle con
   * reemplazo** —el mismo emoji la quita, otro la reemplaza; una por usuario—. Devuelve el
   * `WallMessage` con las `reactions` recalculadas. No dispara push (gesto ligero). `404`
   * `WALL_MESSAGE_NOT_FOUND` / `409` `WALL_MESSAGE_ALREADY_DELETED` si no existe o está borrado.
   */
  react: async (id: string, emoji: string): Promise<WallMessage> => {
    return normalizeWallMessage(
      await api.post<RawWallMessage>(`/wall/messages/${id}/reactions`, { emoji }),
    );
  },

  /**
   * Conteo inicial de presencia (QL-92, §3.26): usuarios ÚNICOS conectados al Muro para el
   * primer render, antes de que el WebSocket `/presence` entregue el primer `presence:count`.
   */
  presence: () => {
    return api.get<WallPresenceCount>('/wall/presence');
  },

  /**
   * Galería "Archivos compartidos" (QL-94, §3.28): `media`/`docs` = `Attachment[]` (con
   * `downloadUrl`), `links` = `WallLinkItem[]`. Paginación **1-based** (`page`/`limit`, 1..50).
   * El `type` viene eco en la respuesta para narrow del `data` (ver `sharedAttachments`/`sharedLinks`).
   */
  shared: (type: WallSharedType, page = 1, limit = 20) => {
    const search = new URLSearchParams({
      type,
      page: String(page),
      limit: String(limit),
    });
    return api.get<WallSharedResponse>(`/wall/shared?${search.toString()}`);
  },
};
