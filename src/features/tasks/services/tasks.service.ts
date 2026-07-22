import { api } from '@/core/api/fetch-client';
import type { Label } from '@/features/labels/services/labels.service';

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

/** Usuario que dio el visto bueno a una tarea (QL-145, §3.39). */
export interface TaskValidatedBy {
  id: string;
  name: string;
}

/** Usuario que **rechazó** la revisión de una tarea (QL-171). */
export interface TaskRejectedBy {
  id: string;
  name: string;
}

/** ADMIN que descartó una tarea (QL-142, §3.41). */
export interface TaskDiscardedBy {
  id: string;
  name: string;
}

/**
 * Estado del visto bueno para cerrar una tarea (QL-145, §3.39; `REJECTED` en QL-171):
 * `NONE` nadie pidió · `REQUESTED` el Responsable solicitó revisión · `VALIDATED` ya validada ·
 * `REJECTED` el Creador/Observador **rechazó** la revisión (con motivo obligatorio).
 *
 * Precedencia del backend al derivarlo: `validatedAt` → `VALIDATED`; si no, `reviewRequestedAt`
 * → `REQUESTED`; si no, `rejectedAt` → `REJECTED`; si no, `NONE`. Tras un rechazo el backend
 * limpia `reviewRequestedAt/By`, así que el Responsable puede corregir y **volver a pedir**
 * revisión (y entonces el estado vuelve a `REQUESTED`).
 */
export type ReviewStatus = 'NONE' | 'REQUESTED' | 'VALIDATED' | 'REJECTED';

/** DTO de respuesta del backend para una tarea (QL-07/QL-08, §3.7). */
export interface Task {
  id: string;
  projectId: string;
  columnId: string;
  title: string;
  description?: string;
  order: number;
  /**
   * (QL-146, §3.38) Ids de etiquetas de la tarea (0 o 1 por ahora; el modelo ya es array para
   * habilitar múltiples más adelante). Reemplaza al viejo `label: string | null` de texto libre.
   */
  labelIds: string[];
  /** (QL-146, §3.38) Las mismas etiquetas ya RESUELTAS para pintar el chip (`labels[0]`). */
  labels: Label[];
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
  /**
   * (QL-145, §3.39) Estado del visto bueno para cerrar: `NONE` nadie pidió, `REQUESTED` el
   * Responsable solicitó revisión, `VALIDATED` ya recibió el visto bueno del Creador u Observador.
   * El ASSIGNEE (que no es Creador) no puede cerrar hasta que esté `VALIDATED`.
   */
  reviewStatus: ReviewStatus;
  /** (QL-145, §3.39) ISO8601 en que el Responsable solicitó revisión, o `null`. */
  reviewRequestedAt: string | null;
  /** (QL-145, §3.39) ISO8601 del visto bueno, o `null` si aún no se validó. */
  validatedAt: string | null;
  /** (QL-145, §3.39) Quién dio el visto bueno, o `null`. Para pintar "Validado por: {name}". */
  validatedBy: TaskValidatedBy | null;
  /** (QL-171) Comentario **opcional** que dejó quien validó, o `null`. */
  validationComment: string | null;
  /** (QL-171) ISO8601 del rechazo de la revisión, o `null` si nunca se rechazó. */
  rejectedAt: string | null;
  /** (QL-171) Quién rechazó la revisión, o `null`. */
  rejectedBy: TaskRejectedBy | null;
  /** (QL-171) Motivo del rechazo (obligatorio al rechazar), o `null`. */
  rejectionComment: string | null;
  /**
   * (QL-62, §3.22) Timing automático por columna (independiente del cierre RF-2.5):
   * `startedAt` = 1ª vez que se movió a la columna `isStart`; `finishedAt` = último cruce a
   * la columna `isEnd`; `durationMs` = `finishedAt − startedAt` (ms) o `null` si falta alguno.
   * El backend los rellena solo al mover; el front no los escribe.
   */
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  /**
   * (QL-142, §3.41) `true` si la tarea está **descartada** (papelera reversible): sale del
   * tablero y de "Mis tareas" y solo aparece en la sección "Descartadas" del proyecto
   * (`GET /tasks?projectId=…&discarded=true`). Distinto de eliminar (QL-143), que la destruye.
   */
  isDiscarded: boolean;
  /** (QL-142, §3.41) ISO8601 del descarte, o `null` si no está descartada. */
  discardedAt: string | null;
  /** (QL-142, §3.41) ADMIN que la descartó, o `null` si no está descartada. */
  discardedBy: TaskDiscardedBy | null;
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
 * Estado de tiempo **automático** de una tarea (P4/§3.13). Ya NO es cronómetro manual: el
 * backend calcula el **tiempo hábil** (horario laboral, §3.23) entre `startedAt` (1ª entrada a
 * la columna `isStart`, QL-62) y `finishedAt` (entrada a la columna `isEnd`) o "ahora" si sigue
 * en curso. `breakdown` queda **siempre vacío** (ya no hay desglose por usuario).
 */
export interface TimeStatus {
  taskId: string;
  /** Tiempo HÁBIL en ms (`startedAt`→`finishedAt ?? ahora`); `0` si no hay `startedAt`. */
  workedMs: number;
  /** Compat: `round(workedMs/1000)`. Ya NO es la suma del cronómetro manual. */
  totalSeconds: number;
  /** ISO8601 — inicio del trabajo (entrada a la columna `isStart`); `null` si no ha empezado. */
  startedAt: string | null;
  /** ISO8601 — fin del trabajo (entrada a la columna `isEnd`); `null` si en curso. */
  finishedAt: string | null;
  /** **Siempre vacío** en P4 (sin desglose por usuario). */
  breakdown: TimeBreakdownEntry[];
  /** ¿En curso? Hay `startedAt` pero aún no `finishedAt`/cierre. */
  running: boolean;
  /** Alias de `startedAt` (compat); `null` si no ha empezado. */
  runningSince: string | null;
}

/** Body para cerrar una tarea (QL-17, §3.13). `summary` opcional en el payload. */
export interface CompleteTaskPayload {
  summary?: string;
}

/** Body del visto bueno (QL-171). `comment` es **opcional** (máx 2000); el POST admite ir sin body. */
export interface ValidateTaskPayload {
  comment?: string;
}

/**
 * Body del **rechazo** de la revisión (QL-171/QL-172). `comment` es **obligatorio** (máx 2000).
 *
 * ⚠️ `newDueDate` (ISO8601) solo lo acepta el **CREATOR**: si lo manda un OBSERVER el backend
 * responde 403 `DEADLINE_EXTENSION_CREATOR_ONLY` y **el rechazo tampoco se aplica**. Por eso la
 * UI oculta el selector de fecha a los no-creadores en vez de deshabilitarlo.
 */
export interface RejectReviewPayload {
  comment: string;
  newDueDate?: string;
}

/** Filtros del listado del tablero (§3.7). El endpoint **no pagina**. */
export interface TaskListParams {
  projectId?: string;
  columnId?: string;
  /**
   * (QL-142, §3.41) `true` → devuelve **SOLO** las tareas descartadas del proyecto (para la
   * sección "Descartadas"). Omitir/`false` → el listado normal, que **excluye** las descartadas.
   */
  discarded?: boolean;
}

/** Body para crear una tarea (§3.7). Si falta `columnId` cae en la columna default. */
export interface CreateTaskPayload {
  projectId: string;
  title: string;
  description?: string;
  columnId?: string;
  /**
   * (QL-146, §3.38) Etiqueta(s) de la tarea: **0 o 1** id, y cada id debe estar en
   * `project.labelIds` (si no → 400 `LABEL_NOT_IN_PROJECT`). `[]` = sin etiqueta.
   */
  labelIds?: string[];
  /** Fecha de inicio ISO opcional. */
  startDate?: string | null;
  /**
   * (P1/§3.6) Fecha límite ISO opcional fijada YA en el alta (QL-09, RF-2.1). Antes solo se
   * fijaba tras crear con `PATCH /tasks/:id/deadline`; ahora puede ir en el POST. Si se omite,
   * la tarea nace sin deadline.
   */
  dueDate?: string;
  /**
   * (P1/§3.6) Bloquea la edición del deadline por no-Creadores (RF-2.1). Default `false`.
   * Solo tiene sentido junto con `dueDate` (bloquear un deadline nulo no aporta nada).
   */
  deadlineLocked?: boolean;
  /**
   * (QL-123) Responsable (`ASSIGNEE`) desde el alta. Debe ser **miembro del proyecto**
   * (si no → 400 `USER_NOT_PROJECT_MEMBER` y la tarea NO se crea). Responsable **único**
   * (RF-1.2). Si es el propio creador el backend lo ignora (conserva su rol `CREATOR`).
   */
  assigneeId?: string;
  /**
   * (QL-123) Colaboradores (`COLLABORATOR`) desde el alta. Todos deben ser **miembros del
   * proyecto**. El backend deduplica: si un id coincide con `assigneeId` gana `ASSIGNEE`, y
   * el creador se descarta. Omitir (o `undefined`) = solo el `CREATOR`, como siempre.
   */
  collaboratorIds?: string[];
  /**
   * (QL-138, §3.34) Observadores (`OBSERVER`, **solo lectura**) desde el alta. Simétrico a
   * `collaboratorIds`: todos deben ser **miembros del proyecto** (si no → 400
   * `USER_NOT_PROJECT_MEMBER` y la tarea NO se crea). El backend deduplica con precedencia
   * `ASSIGNEE` > `COLLABORATOR` > `OBSERVER` y descarta al creador. Reciben la notificación
   * `TASK_ASSIGNED` como el resto de roles iniciales.
   */
  observerIds?: string[];
}

/**
 * Body para mover una tarea en el tablero Kanban (QL-15, §3.7).
 * `columnId` = columna destino; `order` = índice 0-based en esa columna destino.
 * El server reindexa para mantener `order` denso 0..n-1 por columna y **solo devuelve la
 * tarea movida**, así que tras el move hay que reconsultar el listado del proyecto.
 */
export interface MoveTaskPayload {
  columnId: string;
  order: number;
}

/** Body para editar una tarea (§3.7). Todos opcionales; solo el CREATOR puede. */
export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  columnId?: string;
  /**
   * (QL-146, §3.38) Reemplaza el set de etiquetas de la tarea (0 o 1 id ∈ `project.labelIds`):
   * `[]` la deja sin etiqueta; omitirlo no la toca.
   */
  labelIds?: string[];
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
  if (params.columnId) search.set('columnId', params.columnId);
  if (params.discarded) search.set('discarded', 'true');
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

  /**
   * (QL-143, §3.40) **Elimina** la tarea por completo: hard-delete con **cascada** (adjuntos y
   * su fichero, comentarios, notificaciones, checklist, tiempos, transiciones). **Solo ADMIN**
   * de plataforma (403 sin `error.code` si no). **Irreversible**; conserva la auditoría. Devuelve
   * el `Task` eliminado (echo) para el toast.
   */
  remove: (id: string) => {
    return api.delete<Task>(`/tasks/${id}`);
  },

  /**
   * (QL-142, §3.41) **Descarta** la tarea (papelera reversible): la saca del tablero y de "Mis
   * tareas". **Solo ADMIN** (403 si no). Devuelve el `Task` con `isDiscarded: true`.
   */
  discard: (id: string) => {
    return api.post<Task>(`/tasks/${id}/discard`);
  },

  /**
   * (QL-142, §3.41) **Restaura** una tarea descartada a su columna del tablero. **Solo ADMIN**
   * (403 si no). Devuelve el `Task` con `isDiscarded: false`.
   */
  restore: (id: string) => {
    return api.post<Task>(`/tasks/${id}/restore`);
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

  /**
   * Estado de tiempo **automático** de la tarea (P4/§3.13). Cualquier participante (incl.
   * OBSERVER). Los endpoints legacy `timer/start`/`timer/stop` siguen existiendo en el backend
   * por compat, pero el front ya no los usa (el tiempo se fija solo al mover entre columnas).
   */
  getTime: (id: string) => {
    return api.get<TimeStatus>(`/tasks/${id}/time`);
  },

  /** Cierra la tarea con resumen opcional (QL-17, RF-2.5, §3.13). Devuelve el `Task`. */
  complete: (id: string, data: CompleteTaskPayload) => {
    return api.post<Task>(`/tasks/${id}/complete`, data);
  },

  /** Reabre la tarea, limpiando el cierre (QL-17, §3.13). Devuelve el `Task`. */
  reopen: (id: string) => {
    return api.post<Task>(`/tasks/${id}/reopen`);
  },

  /**
   * El Responsable (ASSIGNEE) **solicita revisión** para poder cerrar (QL-145, §3.39). Notifica a
   * Creador+Observadores. Solo ASSIGNEE (si no → 403 `REVIEW_REQUEST_FORBIDDEN`). Devuelve el `Task`.
   */
  requestReview: (id: string) => {
    return api.post<Task>(`/tasks/${id}/request-review`);
  },

  /**
   * El Creador u Observador da el **visto bueno** que habilita el cierre (QL-145, §3.39). Solo
   * CREATOR/OBSERVER (si no → 403 `TASK_VALIDATION_FORBIDDEN`). (QL-171) Admite un `comment`
   * **opcional**; sin payload se comporta como antes. Devuelve el `Task`.
   */
  validate: (id: string, data?: ValidateTaskPayload) => {
    return api.post<Task>(`/tasks/${id}/validate`, data);
  },

  /**
   * (QL-171/QL-172) El Creador u Observador **rechaza** la revisión con un motivo obligatorio y,
   * si es el CREATOR, opcionalmente mueve la fecha límite. Mismos permisos que validar (si no →
   * 403 `TASK_VALIDATION_FORBIDDEN`); `newDueDate` enviado por un no-creador → 403
   * `DEADLINE_EXTENSION_CREATOR_ONLY` **sin aplicar el rechazo**. El backend limpia
   * `reviewRequestedAt/By` para que el Responsable pueda corregir y volver a solicitar revisión.
   * Devuelve el `Task` con `reviewStatus: 'REJECTED'`.
   */
  rejectReview: (id: string, data: RejectReviewPayload) => {
    return api.post<Task>(`/tasks/${id}/reject-review`, data);
  },
};
