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
  | 'WALL_MENTION'
  | 'TASK_ASSIGNED'
  | 'PROJECT_MEMBER_ADDED'
  | 'TASK_MOVED'
  | 'DEADLINE_APPROACHING';

/**
 * Todos los tipos, en el orden en que se ofrecen en el filtro de la bandeja (QL-137). Es la
 * lista canónica del front: refleja el enum `NotificationType` del backend, que valida cada
 * valor del CSV `?type=` (un tipo inexistente → 400).
 */
export const NOTIFICATION_TYPES: readonly NotificationType[] = [
  'MENTION',
  'WALL_MENTION',
  'TASK_ASSIGNED',
  'TASK_MOVED',
  'DEADLINE_APPROACHING',
  'DEADLINE_EXTENSION_REQUEST',
  'PROJECT_MEMBER_ADDED',
];

/** Etiqueta legible de cada tipo, para los chips del filtro (QL-137). */
export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  MENTION: 'Menciones',
  WALL_MENTION: 'Muro',
  TASK_ASSIGNED: 'Asignaciones',
  TASK_MOVED: 'Cambios de estado',
  DEADLINE_APPROACHING: 'Vencimientos',
  DEADLINE_EXTENSION_REQUEST: 'Prórrogas',
  PROJECT_MEMBER_ADDED: 'Proyectos',
};

/** ¿Es `value` un `NotificationType` válido? Narrowing para lo que llega de la URL (QL-137). */
export function isNotificationType(value: string): value is NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(value);
}

/** Usuario que generó la notificación, poblado (§3.10). */
export interface NotificationActor {
  id: string;
  name: string;
  avatarUrl?: string;
  /** QL-32: proxy privado del avatar subido, o `null`/ausente si no hay. */
  avatarDownloadUrl?: string | null;
}

/** Proyecto poblado en la notificación (QL-137, §3.36). `name: ''` si el proyecto ya no existe. */
export interface NotificationProjectRef {
  id: string;
  name: string;
}

/** Tarea poblada en la notificación (QL-137, §3.36). */
export interface NotificationTaskRef {
  id: string;
  title: string;
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
   * ObjectId del proyecto. **(QL-137)** Ya NO es exclusivo de `PROJECT_MEMBER_ADDED`: viene en
   * **todas** las notis de tarea (`MENTION`, `TASK_ASSIGNED`, `TASK_MOVED`, `DEADLINE_*`), y las
   * antiguas se rellenaron con un backfill. `null` en `WALL_MENTION` (el muro es global).
   *
   * ⚠️ Por eso **`projectId != null` ya no implica "la noti es de un proyecto, no de una tarea"**:
   * para decidir a dónde navegar hay que mirar `taskId` PRIMERO (ver `notification-nav.ts`).
   */
  projectId: string | null;
  commentId: string | null;
  /** **(QL-88)** ObjectId del mensaje del muro en `WALL_MENTION`; `null` en el resto. */
  wallMessageId?: string | null;
  /** Fecha propuesta en `DEADLINE_EXTENSION_REQUEST` (QL-09); `null` en otros tipos. */
  requestedDate: string | null;
  /** Motivo de la solicitud de prórroga (QL-09); `null` en otros tipos. */
  reason: string | null;
  /**
   * Quien la generó (poblado). **`null`** en las notis DEL SISTEMA sin actor humano
   * (`DEADLINE_APPROACHING`). Tratar siempre como posiblemente `null` al renderizar.
   */
  actor: NotificationActor | null;
  /**
   * **(QL-137)** Proyecto ya poblado por el backend (sin N+1). **`null` si la noti no cuelga de
   * un proyecto (`WALL_MENTION`) O si el proyecto ya se borró**: el `projectId` crudo se conserva
   * igual, así que NO se puede asumir `projectId != null` ⇒ `project != null` (§3.36).
   */
  project: NotificationProjectRef | null;
  /** **(QL-137)** Tarea ya poblada, o `null` si no cuelga de una tarea o si la tarea se borró. */
  task: NotificationTaskRef | null;
  createdAt: string;
}

/**
 * Filtros de la bandeja (§3.10 + §3.36). Todos opcionales y **combinables**:
 * `unread=true` → solo no leídas; `type` → uno o varios tipos (se serializa como CSV);
 * `projectId`/`taskId` → notis de ese proyecto / esa tarea.
 */
export interface NotificationListParams {
  page?: number;
  limit?: number;
  unread?: boolean;
  /** (QL-137) Multi-selección. Se envía como CSV: `?type=MENTION,TASK_MOVED`. */
  type?: NotificationType[];
  /** (QL-137) ObjectId de proyecto. El backend responde 400 si no lo es. */
  projectId?: string;
  /** (QL-137) ObjectId de tarea. El backend responde 400 si no lo es. */
  taskId?: string;
}

function buildQuery(params: NotificationListParams): string {
  const search = new URLSearchParams();
  if (params.page != null) search.set('page', String(params.page));
  if (params.limit != null) search.set('limit', String(params.limit));
  if (params.unread) search.set('unread', 'true');
  // (QL-137) CSV multi-valor. Una lista vacía NO se envía: `?type=` a secas no filtra, pero
  // mandarlo sería ruido en la URL de la petición.
  if (params.type && params.type.length > 0) search.set('type', params.type.join(','));
  if (params.projectId) search.set('projectId', params.projectId);
  if (params.taskId) search.set('taskId', params.taskId);
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

/** Contador por tipo para dimensionar el chip del filtro (QL-137, §3.36). */
export interface NotificationTypeFacet {
  type: NotificationType;
  count: number;
}

/** Contador por proyecto, con el nombre ya resuelto (QL-137, §3.36). */
export interface NotificationProjectFacet {
  projectId: string;
  /** Cadena vacía si el proyecto ya no existe (la noti huérfana sigue contando). */
  name: string;
  count: number;
}

/**
 * Contadores de **mis** notificaciones para pintar los filtros con números (QL-137, §3.36).
 * `byType`/`byProject` cuentan **todas** (leídas incluidas): son el **tamaño del filtro**, no
 * un badge. Un tipo/proyecto con 0 notis no aparece en la lista.
 */
export interface NotificationFacets {
  unread: number;
  byType: NotificationTypeFacet[];
  byProject: NotificationProjectFacet[];
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

  /** (QL-137) Marca una notificación (la mía) como **NO** leída. Inverso de `markRead`. */
  markUnread: (id: string) => {
    return api.patch<Notification>(`/notifications/${id}/unread`);
  },

  /**
   * (QL-137) Elimina una notificación (la mía). Borrado **físico**: un aviso es efímero, la
   * traza histórica vive en `auditLogs`. Devuelve la notificación borrada.
   */
  remove: (id: string) => {
    return api.delete<Notification>(`/notifications/${id}`);
  },

  /** (QL-137) Contadores para pintar los filtros: `{ unread, byType[], byProject[] }`. */
  facets: () => {
    return api.get<NotificationFacets>('/notifications/facets');
  },
};
