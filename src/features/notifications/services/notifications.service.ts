import { api } from '@/core/api/fetch-client';
import type { Paginated } from '@/shared/types/paginated';

/**
 * Tipos de notificación (§3.10). Extensible:
 * - `MENTION` (QL-13) y `DEADLINE_EXTENSION_REQUEST` (QL-09, con `requestedDate`/`reason`).
 * - **(nuevos)** `TASK_ASSIGNED` (te asignaron a una tarea), `PROJECT_MEMBER_ADDED` (te
 *   agregaron a un proyecto; trae `projectId`, `taskId=null`), `TASK_MOVED` (una tarea en la
 *   que participas cambió de estado), `DEADLINE_APPROACHING` (tu tarea por vencer; noti **del
 *   sistema, `actor=null`**).
 */
export type NotificationType =
  | 'MENTION'
  | 'DEADLINE_EXTENSION_REQUEST'
  | 'TASK_ASSIGNED'
  | 'PROJECT_MEMBER_ADDED'
  | 'TASK_MOVED'
  | 'DEADLINE_APPROACHING';

/** Usuario que generó la notificación, poblado (§3.10). */
export interface NotificationActor {
  id: string;
  name: string;
  avatarUrl?: string;
  /** QL-32: proxy privado del avatar subido, o `null`/ausente si no hay. */
  avatarDownloadUrl?: string | null;
}

/** DTO de respuesta del backend para una notificación (QL-13, §3.10). */
export interface Notification {
  id: string;
  type: NotificationType;
  read: boolean;
  /**
   * ObjectId de la tarea. Presente en `MENTION`/`DEADLINE_EXTENSION_REQUEST`/`TASK_ASSIGNED`/
   * `TASK_MOVED`/`DEADLINE_APPROACHING`; **`null`** en `WALL_MENTION` y `PROJECT_MEMBER_ADDED`.
   */
  taskId: string | null;
  /**
   * **(nuevo)** ObjectId del proyecto. Presente en `PROJECT_MEMBER_ADDED` (proyecto al que te
   * agregaron); `null` en el resto de tipos actuales.
   */
  projectId: string | null;
  commentId: string | null;
  /** Fecha propuesta en `DEADLINE_EXTENSION_REQUEST` (QL-09); `null` en otros tipos. */
  requestedDate: string | null;
  /** Motivo de la solicitud de prórroga (QL-09); `null` en otros tipos. */
  reason: string | null;
  /**
   * Quien la generó (poblado). **`null`** en las notis DEL SISTEMA sin actor humano
   * (`DEADLINE_APPROACHING`). Tratar siempre como posiblemente `null` al renderizar.
   */
  actor: NotificationActor | null;
  createdAt: string;
}

/** Filtros de la bandeja (§3.10). `unread=true` → solo no leídas. */
export interface NotificationListParams {
  page?: number;
  limit?: number;
  unread?: boolean;
}

function buildQuery(params: NotificationListParams): string {
  const search = new URLSearchParams();
  if (params.page != null) search.set('page', String(params.page));
  if (params.limit != null) search.set('limit', String(params.limit));
  if (params.unread) search.set('unread', 'true');
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export const notificationsService = {
  /** Bandeja paginada de **mis** notificaciones (createdAt desc). */
  list: (params: NotificationListParams = {}) => {
    return api.get<Paginated<Notification>>(`/notifications${buildQuery(params)}`);
  },

  /** Contador de **mis** no leídas (base del polling del badge). */
  unreadCount: () => {
    return api.get<{ count: number }>('/notifications/unread-count');
  },

  /** Marca una notificación (la mía) como leída. */
  markRead: (id: string) => {
    return api.patch<Notification>(`/notifications/${id}/read`);
  },

  /** Marca **todas mis** notificaciones como leídas. Devuelve cuántas cambiaron. */
  markAllRead: () => {
    return api.patch<{ modified: number }>('/notifications/read-all');
  },
};
