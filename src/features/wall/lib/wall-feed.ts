import type { Attachment } from '@/features/attachments/services/attachments.service';

import type { WallAuthor, WallMessage, WallReplyPreview } from '../types/wall.types';

/**
 * Utilidades del feed del muro en la caché de TanStack Query.
 *
 * **Convención de orden:** el backend devuelve **descendente** (más reciente primero), pero
 * en la caché guardamos el feed **ascendente** (más antiguo → más nuevo) porque así se pinta
 * un chat (mensajes recientes abajo). Todas las mezclas mantienen ese orden y **deduplican
 * por `id`** (evita duplicados entre el optimista, el POST y el polling).
 */

/** Item del feed en caché: un `WallMessage` que puede estar en vuelo (optimista). */
export interface WallFeedItem extends WallMessage {
  /** `true` mientras el POST está en vuelo (id temporal, aún sin confirmación del servidor). */
  pending?: boolean;
}

/**
 * (QL-148) Item del feed garantizado de **usuario** (autor presente). Los mensajes de sistema
 * (`type:'system'`, `author:null`) los pinta `WallSystemMessage`; `WallView` estrecha a este tipo
 * antes de renderizar la burbuja de usuario, así que `WallMessageItem` no lidia con `author` nulo.
 */
export type WallUserFeedItem = WallFeedItem & { author: WallAuthor };

/**
 * Id del ancla DOM de un mensaje del feed. El panel de fijados (QL-93) lo usa para hacer
 * `scrollIntoView` al mensaje si está cargado en el hilo (`document.getElementById`).
 */
export function wallMessageAnchorId(id: string): string {
  return `wall-message-${id}`;
}

/** Prefijo de los ids temporales de mensajes optimistas (nunca válidos como cursor). */
const OPTIMISTIC_PREFIX = 'optimistic-';

/** Genera un id temporal único para un mensaje optimista. */
export function optimisticId(): string {
  return `${OPTIMISTIC_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** ¿Es un mensaje ya confirmado por el servidor (id real, no optimista)? */
export function isConfirmed(item: WallFeedItem): boolean {
  return !item.pending && !item.id.startsWith(OPTIMISTIC_PREFIX);
}

/** Datos con los que se pinta un mensaje optimista al instante (antes de confirmar el POST). */
export interface OptimisticInput {
  body: string;
  author: WallAuthor;
  /** userIds mencionados (para el resaltado optimista). */
  mentions: string[];
  /** Adjuntos ya subidos (§3.25.2): se muestran en línea desde ya. */
  attachments: Attachment[];
  /** (QL-103) cita del mensaje respondido, para pintar el quote desde ya; `null` si no es respuesta. */
  replyTo?: WallReplyPreview | null;
}

/** Construye el mensaje optimista que se pinta al instante al enviar. */
export function buildOptimisticMessage({
  body,
  author,
  mentions,
  attachments,
  replyTo = null,
}: OptimisticInput): WallFeedItem {
  const now = new Date().toISOString();
  return {
    id: optimisticId(),
    // (QL-148) Un mensaje optimista lo escribe el usuario: siempre `type:'user'`, sin campos de sistema.
    type: 'user',
    systemKind: null,
    meta: null,
    authorId: author.id,
    author,
    deleted: false,
    body,
    mentions,
    attachments,
    editedAt: null,
    deletedAt: null,
    pinnedAt: null,
    pinnedBy: null,
    replyTo,
    // (QL-147) Un mensaje aún en vuelo no tiene reacciones; llegarán con el confirmado del POST.
    reactions: [],
    createdAt: now,
    updatedAt: now,
    pending: true,
  };
}

/**
 * Mezcla mensajes que llegan del backend (siempre **descendente**) en el feed en caché
 * (**ascendente**), deduplicando por `id`. Sirve para historial (`before`) y polling
 * (`after`): en ambos casos el orden final es correcto porque reordenamos por completo.
 */
export function mergeMessages(
  current: WallFeedItem[],
  incoming: WallMessage[],
): WallFeedItem[] {
  if (incoming.length === 0) return current;
  const byId = new Map<string, WallFeedItem>();
  for (const item of current) byId.set(item.id, item);
  // Los mensajes confirmados del backend prevalecen sobre cualquier copia previa.
  for (const item of incoming) byId.set(item.id, item);
  return sortAscending([...byId.values()]);
}

/**
 * Reemplaza un mensaje optimista por el `WallMessage` confirmado que devolvió el POST.
 * Si el temporal ya no existe (caso raro), simplemente mezcla el confirmado.
 */
export function reconcileOptimistic(
  current: WallFeedItem[],
  tempId: string,
  confirmed: WallMessage,
): WallFeedItem[] {
  const withoutTemp = current.filter((item) => item.id !== tempId);
  return mergeMessages(withoutTemp, [confirmed]);
}

/** Quita un mensaje optimista fallido del feed (revertir en error). */
export function removeOptimistic(
  current: WallFeedItem[],
  tempId: string,
): WallFeedItem[] {
  return current.filter((item) => item.id !== tempId);
}

/** Id del mensaje confirmado **más nuevo** (cursor `after` para el polling), o `null`. */
export function newestConfirmedId(feed: WallFeedItem[]): string | null {
  for (let i = feed.length - 1; i >= 0; i -= 1) {
    if (isConfirmed(feed[i])) return feed[i].id;
  }
  return null;
}

/** Id del mensaje confirmado **más antiguo** (cursor `before` para historial), o `null`. */
export function oldestConfirmedId(feed: WallFeedItem[]): string | null {
  for (let i = 0; i < feed.length; i += 1) {
    if (isConfirmed(feed[i])) return feed[i].id;
  }
  return null;
}

/** Ordena ascendente por `createdAt` y, a igualdad, por `id` (estable). */
function sortAscending(items: WallFeedItem[]): WallFeedItem[] {
  return items.sort((a, b) => {
    const byTime = a.createdAt.localeCompare(b.createdAt);
    return byTime !== 0 ? byTime : a.id.localeCompare(b.id);
  });
}
