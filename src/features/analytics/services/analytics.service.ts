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

export const analyticsService = {
  /** Métricas globales (`GET /analytics/overview`, solo ADMIN). */
  getOverview: () => api.get<AnalyticsOverview>('/analytics/overview'),
  /** Métricas de un proyecto (`GET /analytics/projects/:id`, ADMIN o creador). */
  getProject: (projectId: string) =>
    api.get<ProjectAnalytics>(`/analytics/projects/${projectId}`),
};
