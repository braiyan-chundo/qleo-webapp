import { api } from '@/core/api/fetch-client';

/**
 * DTOs de la analítica (QL-65, §3.24). Endpoints de **solo lectura** que agregan tareas,
 * transiciones de columna (QL-62) y adjuntos. La forma refleja fielmente el contrato del
 * backend; todo el consumo pasa por TanStack Query (hooks en `../hooks`).
 *
 * Nota: la métrica 2.1 (accesos por miembro/día) quedó **fuera de alcance** (QL-64 en
 * validación) → no hay endpoint de accesos y la vista no la muestra.
 */

/** Usuario reducido en las métricas. `avatarDownloadUrl` → proxy privado (usar AuthedAvatar). */
export interface AnalyticsUser {
  id: string;
  name: string;
  avatarDownloadUrl: string | null;
}

/** Desglose abierto/cerrado de un conjunto de tareas. */
export interface TaskOpenClosed {
  total: number;
  open: number;
  closed: number;
}

/** 2.3 — tareas por miembro. `participating` = cualquier rol; `assignee` = solo Responsable. */
export interface MemberTaskStats {
  user: AnalyticsUser;
  participating: TaskOpenClosed;
  assignee: TaskOpenClosed;
}

/** 2.6 — throughput semanal (12 semanas asc; `weekStart` es el lunes UTC). */
export interface ThroughputPoint {
  weekStart: string;
  closed: number;
}

/** Métricas globales del sistema (solo ADMIN). */
export interface AnalyticsOverview {
  totals: {
    projects: number;
    tasks: number;
    openTasks: number;
    closedTasks: number;
    overdueTasks: number;
  };
  tasksByMember: MemberTaskStats[];
  throughput: ThroughputPoint[];
}

/** 2.4 — tiempo agregado en una columna (reconstruido desde `TaskTransition`). */
export interface TimePerColumnEntry {
  columnId: string;
  /** null si la columna fue eliminada (histórico de transiciones). */
  name: string | null;
  isStart: boolean;
  isEnd: boolean;
  totalMs: number;
  avgMs: number;
  visits: number;
}

/** Métricas de un proyecto (ADMIN o creador). */
export interface ProjectAnalytics {
  projectId: string;
  totals: {
    tasks: number;
    openTasks: number;
    closedTasks: number;
    overdueTasks: number;
  };
  tasksByMember: MemberTaskStats[];
  timePerColumn: TimePerColumnEntry[];
  /** 2.4 complemento: duración inicio→fin (startedAt→finishedAt). */
  flowDuration: {
    taskCount: number;
    totalMs: number;
    avgMs: number;
  };
  /** 2.5: adjuntos por scope. */
  attachments: {
    total: number;
    project: number;
    task: number;
  };
  throughput: ThroughputPoint[];
}

/**
 * P5 — tiempo agregado en una **etapa** de una tarea (reloj de pared). Mismo patrón que
 * `TimePerColumnEntry` pero por etapa (sin `isStart`/`isEnd`).
 */
export interface StageTimeStats {
  stageId: string;
  /** null si la etapa fue eliminada (histórico de transiciones). */
  name: string | null;
  totalMs: number;
  avgMs: number;
  visits: number;
}

/**
 * P5 — estado de tiempo **actual** de una tarea. `workedMs` es tiempo **hábil** (horario
 * laboral); `wallMs` es **reloj de pared** crudo del mismo tramo.
 */
export interface TaskCurrentStats {
  startedAt: string | null;
  finishedAt: string | null;
  completedAt: string | null;
  workedMs: number;
  wallMs: number;
  running: boolean;
  columnId: string;
  columnName: string | null;
  stageId: string;
  stageName: string | null;
}

/**
 * P5 (§3.24) — análisis detallado de UNA tarea. `timePerColumn`/`timePerStage` usan **reloj de
 * pared** (tiempo de estancia); el **tiempo hábil** solo aparece en `current.workedMs`.
 */
export interface TaskAnalytics {
  taskId: string;
  projectId: string;
  title: string;
  /** Reutiliza el shape de 2.4 (columnas con 0 incluidas; orden = `order` de columna). */
  timePerColumn: TimePerColumnEntry[];
  timePerStage: StageTimeStats[];
  current: TaskCurrentStats;
}

/**
 * P6 (§3.24) — perfil de rendimiento por usuario. Todos los tiempos en **ms**. `avgDurationMs`
 * es tiempo **hábil**; `avgDelayMs` es **reloj de pared**. `efficiency` 0–100 (puntualidad ×
 * avance), la calcula el backend y el front la muestra tal cual.
 */
export interface UserPerformance {
  user: AnalyticsUser;
  /** Proyectos distintos donde es MIEMBRO. */
  projects: number;
  /** Tareas donde es ASSIGNEE (Responsable único), total. */
  assignedTasks: number;
  /** Tareas donde participa con CUALQUIER rol, total. */
  totalTasks: number;
  /** ASSIGNEE finalizadas (`completedAt != null`). */
  completedTasks: number;
  /** ASSIGNEE finalizadas con `dueDate` y `completedAt <= dueDate`. */
  onTime: number;
  /** ASSIGNEE finalizadas con `dueDate` y `completedAt > dueDate`. */
  late: number;
  /** Media del tiempo HÁBIL `startedAt`→`finishedAt` sobre ASSIGNEE finalizadas; `0` si ninguna. */
  avgDurationMs: number;
  /** Media de `max(0, completedAt − dueDate)` sobre ASSIGNEE finalizadas con `dueDate`; `0` si ninguna. */
  avgDelayMs: number;
  /** 0–100 (a-tiempo × avance). */
  efficiency: number;
}

export const analyticsService = {
  /** Métricas globales (`GET /analytics/overview`, solo ADMIN). */
  getOverview: () => api.get<AnalyticsOverview>('/analytics/overview'),
  /** Métricas de un proyecto (`GET /analytics/projects/:id`, ADMIN o creador). */
  getProject: (projectId: string) =>
    api.get<ProjectAnalytics>(`/analytics/projects/${projectId}`),
  /** Análisis de una tarea (`GET /analytics/tasks/:id`, **solo ADMIN**; §3.24, P5). */
  getTaskAnalytics: (taskId: string) =>
    api.get<TaskAnalytics>(`/analytics/tasks/${taskId}`),
  /** Rendimiento por usuario (`GET /analytics/users`, **solo ADMIN**; §3.24, P6). */
  getUsersPerformance: () => api.get<UserPerformance[]>('/analytics/users'),
};
