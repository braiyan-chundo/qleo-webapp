/**
 * Tipos de la galería "Archivos compartidos" del Muro (QL-96, §3.28). Alimenta el panel
 * lateral con tres galerías agregadas del canal: **Media** (adjuntos `image/*`), **Docs**
 * (adjuntos no imagen) y **Links** (URLs extraídas del cuerpo de los mensajes).
 *
 * `media`/`docs` reutilizan el mismo objeto `Attachment` de §3.11 (con `downloadUrl`); `links`
 * usa `WallLinkItem`. El endpoint (`GET /wall/shared`) **eco del `type`** en la respuesta, lo
 * que permite al front saber qué shape leer sin adivinar.
 */

import type { Attachment } from '@/features/attachments/services/attachments.service';

/** Pestaña/galería solicitada (query param `type`, obligatorio en §3.28). */
export type WallSharedType = 'media' | 'docs' | 'links';

/** Un enlace agregado de la galería `links` (§3.28). NO se deduplica entre mensajes. */
export interface WallLinkItem {
  /** URL `http(s)` extraída del cuerpo del mensaje. */
  url: string;
  /** Mensaje donde se escribió (para saltar a él si estuviera en la ventana cargada). */
  wallMessageId: string;
  /** ISO8601 del mensaje (base del orden, más reciente primero). */
  createdAt: string;
  /** Nombre del autor del mensaje, o `null` si no se pudo poblar. */
  authorName: string | null;
}

/**
 * Respuesta paginada de `GET /wall/shared` (§3.28). `data` es un array de `Attachment`
 * (`type='media'|'docs'`) o de `WallLinkItem` (`type='links'`); usa los selectores de abajo
 * para narrow seguro según el `type` eco.
 */
export interface WallSharedResponse {
  data: Attachment[] | WallLinkItem[];
  /** Total de items del tipo (para calcular páginas / decidir "Ver todos"). */
  total: number;
  /** Página actual (1-based). */
  page: number;
  /** Tamaño de página aplicado. */
  limit: number;
  /** Eco del tipo solicitado → el front sabe qué shape tiene `data`. */
  type: WallSharedType;
}

/**
 * Narrow seguro a `Attachment[]` (para `media`/`docs`): devuelve `[]` si la respuesta es de
 * `links` o aún no llegó. El `type` eco garantiza que el cast solo se aplica cuando el shape
 * es realmente de adjuntos (no es un `any` a ciegas).
 */
export function sharedAttachments(res: WallSharedResponse | undefined): Attachment[] {
  if (!res || res.type === 'links') return [];
  return res.data as Attachment[];
}

/** Narrow seguro a `WallLinkItem[]` (para `links`): `[]` si la respuesta no es de `links`. */
export function sharedLinks(res: WallSharedResponse | undefined): WallLinkItem[] {
  if (!res || res.type !== 'links') return [];
  return res.data as WallLinkItem[];
}
