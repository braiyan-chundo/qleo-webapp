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
 * Reacción **agrupada por emoji** a un mensaje del muro (QL-147, §3.42). El backend agrupa por
 * emoji (una reacción por usuario y mensaje) y devuelve el array ordenado por `count` desc. El
 * front deriva **"mía"** = `userIds.includes(miUserId)` (id del usuario logueado). `userIds` sirve
 * además para el tooltip "quién reaccionó". En una **lápida** (`deleted:true`) es `[]`.
 */
export interface WallReaction {
  /** Emoji (literal Unicode). */
  emoji: string;
  /** Nº de usuarios que reaccionaron con este emoji (= `userIds.length`). */
  count: number;
  /** userIds que reaccionaron con este emoji. Contiene el propio id si la reacción es mía. */
  userIds: string[];
}

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

/**
 * Tipo de mensaje del muro (QL-148, §3.43). `'user'` = mensaje normal (el default en respuestas
 * previas a QL-148, que no traían `type`). `'system'` = aviso generado por la plataforma (p.ej. el
 * aviso de nueva versión): sin autor, inmutable y sin acciones de usuario.
 */
export type WallMessageType = 'user' | 'system';

/**
 * Metadatos de un mensaje de sistema (QL-148, §3.43). En `systemKind: 'version_release'` trae la
 * versión anunciada (`{ version: 'X.Y.Z' }`); `null` en los mensajes de usuario.
 */
export interface WallSystemMeta {
  /** Versión anunciada en un aviso de release (SemVer `x.y.z`). */
  version?: string;
}

/** Mensaje expandido del muro (§3.25). */
export interface WallMessage {
  id: string;
  /**
   * (QL-148) Discriminador: `'user'` en mensajes normales, `'system'` en avisos de la plataforma.
   * El backend puede omitirlo en respuestas antiguas → el servicio lo normaliza a `'user'`.
   */
  type: WallMessageType;
  /**
   * (QL-148) Subtipo del mensaje de sistema (`'version_release'` en el aviso de nueva versión), o
   * `null` en un mensaje de usuario.
   */
  systemKind: string | null;
  /** (QL-148) Metadatos del mensaje de sistema (`{ version }` en `version_release`), o `null`. */
  meta: WallSystemMeta | null;
  /** (QL-148) `null` en un mensaje de sistema (no tiene autor); el id del autor en los de usuario. */
  authorId: string | null;
  /** Autor poblado, o `null` en un mensaje de sistema (QL-148). */
  author: WallAuthor | null;
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
  /**
   * (QL-147, §3.42) Reacciones agrupadas por emoji, orden `count` desc. `[]` si nadie reaccionó y
   * SIEMPRE `[]` en una lápida (`deleted:true`). Se deriva "mía" cruzando `userIds` con el id del
   * usuario logueado.
   */
  reactions: WallReaction[];
  /**
   * (QL-167) `true` si el mensaje se envió como **difusión** (`@muro`): el backend detecta el texto
   * `@muro` en el body, lo **retira** del texto guardado y hace fan-out de push a TODOS los usuarios.
   * `@muro` NO es una mención de usuario (no entra en `mentions`). El front pinta el distintivo
   * "📢 Difusión". El servicio lo normaliza a `false` en respuestas previas a QL-167.
   */
  isBroadcast: boolean;
  /** ISO8601 (base del cursor de paginación: el `id`/ObjectId ya ordena por tiempo). */
  createdAt: string;
  updatedAt: string;
}

/**
 * Query params del feed (`GET /wall/messages`). `before`/`after` son mutuamente excluyentes.
 * **(QL-119)** `around` **prevalece** sobre ambos: pide una ventana centrada en ese mensaje
 * (para el "saltar al mensaje" del buscador); no lo combines con `before`/`after`.
 */
export interface WallFeedParams {
  /** Devuelve mensajes **más antiguos** que ese id → scroll hacia atrás (historial). */
  before?: string;
  /** Devuelve mensajes **más nuevos** que ese id → polling de novedades. */
  after?: string;
  /**
   * (QL-119) Centra la ventana en ese mensaje (~limit/2 más nuevos + el propio + ~limit/2 más
   * antiguos). **Prevalece** sobre `before`/`after`. Id inexistente → 404 `WALL_MESSAGE_NOT_FOUND`.
   */
  around?: string;
  /** Tamaño de página 1..50, default 30. */
  limit?: number;
}

/**
 * Resultado **mínimo** del buscador del Muro (QL-119, `GET /wall/search`). NO es el
 * `WallMessage` completo: solo lo justo para pintar el índice tipo WhatsApp (avatar + nombre +
 * extracto + fecha). El `id` sirve como `?around=<id>` para saltar y cargar el mensaje completo.
 */
export interface WallSearchResult {
  /** Id del mensaje → úsalo como `?around=<id>` para saltar a su posición en el feed. */
  id: string;
  /** Extracto del `body` (espacios colapsados, máx ~160 chars, "…" si se truncó). */
  snippet: string;
  authorId: string;
  /** Nombre del autor (poblado). */
  authorName: string;
  /** Ruta proxy `/users/:id/avatar` (requiere token → `AuthedAvatar`), o `null` si no hay imagen. */
  authorAvatarUrl: string | null;
  /** ISO8601 de creación del mensaje. */
  createdAt: string;
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

/** Modo de actividad en el composer del muro: teclear texto o grabar audio (QL-125). */
export type WallTypingKind = 'text' | 'audio';

/**
 * Un usuario que está **escribiendo/grabando** ahora mismo en el muro (QL-125, §3.26). El
 * servidor ya **excluye al propio usuario** del conjunto que envía.
 */
export interface WallTyper {
  userId: string;
  name: string;
  kind: WallTypingKind;
}

/**
 * Payload del evento WS `wall:typing` (**servidor→cliente**) del namespace `/presence`
 * (QL-125): el conjunto ACTUAL de quienes escriben/graban. Se re-emite ante cada cambio;
 * llega `{ typers: [] }` cuando nadie escribe.
 */
export interface WallTypingEvent {
  typers: WallTyper[];
}

/**
 * Payload del emit `wall:typing` (**cliente→servidor**) del namespace `/presence` (QL-125):
 * un heartbeat (~2 s) mientras el usuario teclea (`'text'`) o graba un audio (`'audio'`). El
 * cese se señala con `wall:typing:stop` (sin payload).
 */
export interface WallTypingSignal {
  kind: WallTypingKind;
}
