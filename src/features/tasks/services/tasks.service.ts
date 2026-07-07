import { api } from '@/core/api/fetch-client';

/** Rol de un usuario POR TAREA (QL-08, §3.7). Distinto del rol de plataforma. */
export type TaskRole = 'CREATOR' | 'ASSIGNEE' | 'COLLABORATOR' | 'OBSERVER';

/** Datos básicos poblados del usuario dentro de un `TaskAssignment` (§3.7). */
export interface TaskAssignmentUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  /** QL-32: proxy privado del avatar subido, o `null` si no hay. */
  avatarDownloadUrl?: string | null;
}

/** Vínculo usuario↔tarea con su rol (§3.7). `user` solo viene poblado en el detalle. */
export interface TaskAssignment {
  userId: string;
  role: TaskRole;
  user?: TaskAssignmentUser;
}

/** Usuario que cerró una tarea (QL-17, §3.13). */
export interface TaskCompletedBy {
  id: string;
  name: string;
}

/** DTO de respuesta del backend para una tarea (QL-07/QL-08, §3.7). */
export interface Task {
  id: string;
  projectId: string;
  stageId: string;
  columnId: string;
  title: string;
  description?: string;
  order: number;
  /** Categoría corta opcional (p.ej. "VUELOS"), o `null`. Se muestra como pill en la card. */
  label: string | null;
  /** Fecha de inicio ISO opcional, o `null`. */
  startDate: string | null;
  /** Ítems de checklist completados (poblado en LISTA y detalle; 0 en mutaciones). */
  checklistDone: number;
  /** Total de ítems de checklist (poblado en LISTA y detalle; 0 en mutaciones). */
  checklistTotal: number;
  /** Fecha límite ISO, o `null` si no tiene (QL-09, §3.7). */
  dueDate: string | null;
  /** Si el Creador bloqueó la edición de la fecha por no-Creadores (QL-09, §3.7). */
  deadlineLocked: boolean;
  assignments: TaskAssignment[];
  /** Rol del usuario del token en esta tarea (o `null` si no participa). Gobierna la UI. */
  currentUserRole: TaskRole | null;
  /** Fecha de cierre ISO, o `null` si no está completada (QL-17, §3.13). */
  completedAt: string | null;
  /** Resumen de resultados registrado al cerrar, o `null` (QL-17, §3.13). */
  completionSummary: string | null;
  /** Usuario que cerró la tarea, o `null` (QL-17, §3.13). */
  completedBy: TaskCompletedBy | null;
  /** `true` si `completedAt != null` (QL-17, §3.13). */
  isCompleted: boolean;
  createdAt: string;
}

/** Usuario dentro del desglose de tiempo (QL-17, §3.13). */
export interface TimeBreakdownUser {
  id: string;
  name: string;
  avatarUrl?: string;
  /** QL-32: proxy privado del avatar subido, o `null` si no hay. */
  avatarDownloadUrl?: string | null;
}

/** Un tramo del desglose de tiempo por usuario (QL-17, §3.13). */
export interface TimeBreakdownEntry {
  user: TimeBreakdownUser;
  /** Total acumulado (en segundos) de ese usuario, solo tramos cerrados. */
  seconds: number;
}

/**
 * Estado de tiempo de una tarea (QL-17, §3.13). `totalSeconds`/`breakdown` NO incluyen el
 * tramo en marcha (aún no cerrado); `running`/`runningSince` son del **usuario del token**.
 */
export interface TimeStatus {
  taskId: string;
  totalSeconds: number;
  breakdown: TimeBreakdownEntry[];
  /** ¿El usuario del token tiene un cronómetro en marcha ahora? */
  running: boolean;
  /** ISO8601 del inicio del tramo en marcha del usuario, o `null`. */
  runningSince: string | null;
}

/** Body para cerrar una tarea (QL-17, §3.13). `summary` opcional en el payload. */
export interface CompleteTaskPayload {
  summary?: string;
}

/** Filtros del listado del tablero (§3.7). El endpoint **no pagina**. */
export interface TaskListParams {
  projectId?: string;
  stageId?: string;
  columnId?: string;
}

/** Body para crear una tarea (§3.7). Si falta `columnId` cae en la columna default. */
export interface CreateTaskPayload {
  projectId: string;
  stageId: string;
  title: string;
  description?: string;
  columnId?: string;
  /** Categoría corta opcional (p.ej. "VUELOS"). */
  label?: string;
  /** Fecha de inicio ISO opcional. */
  startDate?: string | null;
}

/**
 * Body para mover una tarea en el tablero Kanban (QL-15, §3.7).
 * `columnId` = columna destino; `order` = índice 0-based en esa columna destino.
 * El server reindexa para mantener `order` denso 0..n-1 por columna y **solo devuelve la
 * tarea movida**, así que tras el move hay que reconsultar el listado del proyecto.
 * `stageId` NO cambia (las columnas son estados; la etapa es otra dimensión).
 */
export interface MoveTaskPayload {
  columnId: string;
  order: number;
}

/** Body para editar una tarea (§3.7). Todos opcionales; solo el CREATOR puede. */
export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  stageId?: string;
  columnId?: string;
  /** Categoría corta; `null` la limpia. */
  label?: string | null;
  /** Fecha de inicio ISO; `null` la limpia. */
  startDate?: string | null;
}

/** Body para asignar/cambiar el rol por tarea de un usuario (§3.7). Solo el CREATOR. */
export interface AssignRolePayload {
  userId: string;
  role: TaskRole;
}

/**
 * Body para fijar/cambiar/quitar la fecha límite y (des)bloquearla (QL-09, §3.7).
 * `dueDate: null` limpia la fecha; omitir no la toca. `locked` solo lo respeta el CREATOR.
 */
export interface SetDeadlinePayload {
  dueDate?: string | null;
  locked?: boolean;
}

/**
 * Body para solicitar prórroga (QL-09, §3.7). NO cambia la fecha: notifica al CREATOR.
 * Permitido a ASSIGNEE/COLLABORATOR.
 */
export interface RequestDeadlineExtensionPayload {
  requestedDate: string;
  reason: string;
}

function buildQuery(params: TaskListParams): string {
  const search = new URLSearchParams();
  if (params.projectId) search.set('projectId', params.projectId);
  if (params.stageId) search.set('stageId', params.stageId);
  if (params.columnId) search.set('columnId', params.columnId);
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export const tasksService = {
  list: (params: TaskListParams = {}) => {
    return api.get<Task[]>(`/tasks${buildQuery(params)}`);
  },

  /**
   * Tareas del usuario del token en **todos** los proyectos (donde participa en
   * `assignments[]`, cualquier rol). Ya viene ordenado por `dueDate` asc (sin fecha al
   * final). Cada tarea trae `currentUserRole` (§3.7). No pagina.
   */
  listMine: () => {
    return api.get<Task[]>('/tasks/mine');
  },

  getById: (id: string) => {
    return api.get<Task>(`/tasks/${id}`);
  },

  create: (data: CreateTaskPayload) => {
    return api.post<Task>('/tasks', data);
  },

  update: (id: string, data: UpdateTaskPayload) => {
    return api.patch<Task>(`/tasks/${id}`, data);
  },

  /**
   * Mueve una tarea a `columnId` en el índice `order` (QL-15, §3.7). El backend reindexa
   * el resto de la columna y devuelve **solo la tarea movida**; el listado se reconcilia
   * invalidando `taskKeys.list(projectId)`.
   */
  move: (id: string, data: MoveTaskPayload) => {
    return api.patch<Task>(`/tasks/${id}/move`, data);
  },

  remove: (id: string) => {
    return api.delete<Task>(`/tasks/${id}`);
  },

  assignRole: (id: string, data: AssignRolePayload) => {
    return api.post<Task>(`/tasks/${id}/roles`, data);
  },

  removeRole: (id: string, userId: string) => {
    return api.delete<Task>(`/tasks/${id}/roles/${userId}`);
  },

  setDeadline: (id: string, data: SetDeadlinePayload) => {
    return api.patch<Task>(`/tasks/${id}/deadline`, data);
  },

  requestDeadlineExtension: (id: string, data: RequestDeadlineExtensionPayload) => {
    return api.post<{ success: true }>(`/tasks/${id}/deadline/extension-request`, data);
  },

  /** Estado de tiempo de la tarea (QL-17, §3.13). Cualquier participante (incl. OBSERVER). */
  getTime: (id: string) => {
    return api.get<TimeStatus>(`/tasks/${id}/time`);
  },

  /** Inicia el cronómetro del usuario en la tarea (QL-17, §3.13). Devuelve el `TimeStatus`. */
  startTimer: (id: string) => {
    return api.post<TimeStatus>(`/tasks/${id}/timer/start`);
  },

  /** Detiene el cronómetro del usuario en la tarea (QL-17, §3.13). Devuelve el `TimeStatus`. */
  stopTimer: (id: string) => {
    return api.post<TimeStatus>(`/tasks/${id}/timer/stop`);
  },

  /** Cierra la tarea con resumen opcional (QL-17, RF-2.5, §3.13). Devuelve el `Task`. */
  complete: (id: string, data: CompleteTaskPayload) => {
    return api.post<Task>(`/tasks/${id}/complete`, data);
  },

  /** Reabre la tarea, limpiando el cierre (QL-17, §3.13). Devuelve el `Task`. */
  reopen: (id: string) => {
    return api.post<Task>(`/tasks/${id}/reopen`);
  },
};
