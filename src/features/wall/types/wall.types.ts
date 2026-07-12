/**
 * Tipos del Muro Corporativo (QL-86, §3.25). Un tablón/chat único global visible para
 * todos los usuarios autenticados (espacio único implícito del MVP: sin `workspaceId`).
 *
 * `WallMessage` es la forma **expandida** que devuelven todos los endpoints que retornan
 * un mensaje (`GET feed`, `POST`, `PATCH`, `DELETE`).
 */

import type { Attachment } from '@/features/attachments/services/attachments.service';

/** Autor poblado de un mensaje del muro (siempre presente en `WallMessage.author`). */
export interface WallAuthor {
  id: string;
  name: string;
  /**
   * Proxy privado del avatar subido (`/users/:id/avatar`, requiere token → usar
   * `AuthedAvatar`), o `null` si no hay imagen → se muestran las iniciales.
   */
  avatarDownloadUrl: string | null;
}

/**
 * ADMIN que fijó un mensaje (QL-93, §3.27). Mismo shape que `WallAuthor`; poblado en
 * `WallMessage.pinnedBy` cuando el mensaje está fijado, `null` si no lo está.
 */
export type WallPinnedBy = WallAuthor;

/**
 * Vista **reducida** del mensaje citado cuando otro lo responde (QL-103, §3.25). Poblada en
 * `WallMessage.replyTo` si ese mensaje es una respuesta; `null` si no. El backend ya resuelve
 * el `preview` (extracto ≤120 chars, o "📎 Adjunto" / "🎤 Nota de voz" / "Este mensaje fue
 * eliminado"). El `id` permite saltar/scrollear al mensaje original en el feed.
 */
export interface WallReplyPreview {
  id: string;
  /** Autor del citado (solo `id` + `name`; sin avatar). */
  author: { id: string; name: string };
  /** Extracto corto del citado, ya resuelto por el backend. */
  preview: string;
}

/** Mensaje expandido del muro (§3.25). */
export interface WallMessage {
  id: string;
  authorId: string;
  /** Autor poblado. */
  author: WallAuthor;
  /**
   * `true` si el mensaje fue **eliminado** (soft-delete). El feed ahora DEVUELVE los borrados
   * como "lápida": llegan con `body:null`, `attachments/mentions:[]`, `pinnedAt/pinnedBy/editedAt:
   * null`, conservando `id/author/createdAt`. El servicio los **normaliza** (`normalizeWallMessage`)
   * para que `body` siga siendo `string` (''), y la UI (`WallMessageItem`) pinta la lápida.
   */
  deleted: boolean;
  /** Texto plano; el front NO renderiza HTML crudo (React ya lo escapa al pintar `{body}`). */
  body: string;
  /** userIds mencionados (ids, NO poblados). El resaltado (QL-90) cruza estos ids con el directorio. */
  mentions: string[];
  /**
   * Adjuntos **expandidos** (QL-87b): el mismo objeto `Attachment` de §3.11 con `scope='wall'`
   * (`id`, `originalName`, `mimeType`, `size`, `downloadUrl`…). `[]` si el mensaje no lleva adjuntos.
   * Se renderiza/descarga igual que en `features/attachments` (blob+Bearer sobre `downloadUrl`).
   */
  attachments: Attachment[];
  /** ISO8601 de la última edición, o `null` si nunca se editó → mostrar "editado". */
  editedAt: string | null;
  /** ISO8601 del soft-delete, o `null`. En el feed SIEMPRE `null` (los borrados no aparecen). */
  deletedAt: string | null;
  /**
   * ISO8601 en que un ADMIN fijó el mensaje (QL-93, §3.27), o `null` si NO está fijado.
   * Fuente del indicador "X fijó un mensaje" y del orden del panel de fijados (desc).
   */
  pinnedAt: string | null;
  /** ADMIN que fijó el mensaje (poblado), o `null` si no está fijado (QL-93, §3.27). */
  pinnedBy: WallPinnedBy | null;
  /**
   * Vista reducida del mensaje citado (QL-103) si ESTE es una respuesta; `null` si no lo es.
   * SIEMPRE `null` en una lápida (`deleted:true`).
   */
  replyTo: WallReplyPreview | null;
  /** ISO8601 (base del cursor de paginación: el `id`/ObjectId ya ordena por tiempo). */
  createdAt: string;
  updatedAt: string;
}

/** Query params del feed (`GET /wall/messages`). `before`/`after` son mutuamente excluyentes. */
export interface WallFeedParams {
  /** Devuelve mensajes **más antiguos** que ese id → scroll hacia atrás (historial). */
  before?: string;
  /** Devuelve mensajes **más nuevos** que ese id → polling de novedades. */
  after?: string;
  /** Tamaño de página 1..50, default 30. */
  limit?: number;
}

/**
 * Body de creación (`POST /wall/messages`). El mensaje es válido con **body no vacío O ≥1
 * adjunto** (QL-87); si no, el backend responde `WALL_MESSAGE_EMPTY`.
 */
export interface CreateWallMessageDto {
  /** Opcional (máx 4000 chars, trim). Omítelo/vacío solo si hay ≥1 `attachmentId`. */
  body?: string;
  /** userIds mencionados (resueltos por el front vía `/users/directory`). */
  mentions?: string[];
  /** ids de adjuntos ya subidos vía `POST /wall/attachments` (§3.25.2). */
  attachmentIds?: string[];
  /**
   * (QL-103) id del mensaje citado al **responder** (estilo WhatsApp). Debe existir y no estar
   * borrado; si no, el backend responde `404 WALL_MESSAGE_NOT_FOUND` y no crea el mensaje.
   */
  replyTo?: string;
}

/**
 * Body de edición (`PATCH /wall/messages/:id`, solo autor). `body` **obligatorio** (la
 * edición NO gestiona adjuntos). `mentions`, si viene, es el **nuevo set completo**.
 */
export interface UpdateWallMessageDto {
  body: string;
  mentions?: string[];
}

/**
 * Respuesta de `GET /wall/unread-count` (QL-91, §3.25). Mensajes no leídos: creados tras
 * tu `lastReadAt`, que no son tuyos y no están borrados. Base del badge del nav.
 */
export interface WallUnreadCount {
  count: number;
}

/** Respuesta de `POST /wall/read` (QL-91, §3.25): upsert del estado de lectura propio. */
export interface WallReadResult {
  ok: true;
  /** ISO8601 del instante en que se marcó leído. */
  lastReadAt: string;
}

/**
 * Respuesta de `GET /wall/presence` (QL-92, §3.26): conteo inicial de usuarios ÚNICOS
 * conectados al Muro (un usuario con N pestañas cuenta 1). Es solo el número inicial (evita
 * el parpadeo "· 0 en línea"); luego el WebSocket `/presence` toma el relevo en vivo.
 */
export interface WallPresenceCount {
  count: number;
}

/** Payload del evento WS `presence:count` del namespace `/presence` (QL-92, §3.26). */
export interface PresenceCountEvent {
  count: number;
}

/** Payload del evento WS `presence:error` (token inválido/ausente; QL-92, §3.26). */
export interface PresenceErrorEvent {
  message: 'UNAUTHORIZED';
}
