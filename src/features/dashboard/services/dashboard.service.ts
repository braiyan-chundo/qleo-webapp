import { api } from '@/core/api/fetch-client';

/**
 * DTOs del endpoint de agregación del dashboard personal (QL-18/QL-19, §3.14).
 * Todo es **solo lectura**: agrega tareas, cronómetro, proyecto foco y menciones del
 * usuario autenticado en una sola llamada. La forma refleja fielmente `MyDashboard`.
 */

/** Una tarea próxima del bloque "Mis tareas" (`tasks.upcoming`). */
export interface TaskSummary {
  id: string;
  title: string;
  dueDate: string | null;
  projectId: string;
  projectName: string | null;
  columnName: string | null;
}

/** Cronómetro en marcha del usuario (o `null` si no hay ninguno). */
export interface ActiveTimer {
  taskId: string;
  taskTitle: string | null;
  projectId: string | null;
  /** ISO de inicio; el cliente calcula el transcurrido en vivo desde aquí. */
  startedAt: string;
}

/** Proyecto foco (mayor actividad reciente donde participo). */
export interface FocusProject {
  id: string;
  name: string;
  code: string | null;
  /** 0–100; alimenta directamente la barra de progreso. */
  progressPct: number;
}

/** Mención reciente reducida (§3.14). El texto lo compone el cliente. */
export interface MentionSummary {
  id: string;
  taskId: string;
  isRead: boolean;
  createdAt: string;
}

/** Respuesta completa de `GET /dashboard/me`. */
export interface MyDashboard {
  tasks: {
    overdue: number;
    today: number;
    upcoming: TaskSummary[];
  };
  completedToday: number;
  activeTimer: ActiveTimer | null;
  focusProject: FocusProject | null;
  recentMentions: MentionSummary[];
}

/** Conteo de usuarios por rol de plataforma (`usersByRole`). */
export interface UsersByRole {
  ADMIN: number;
  MEMBER: number;
}

/** Entrada reducida de auditoría del panel ADMIN (§3.14, `recentAudit`). */
export interface AuditSummary {
  id: string;
  /** Nombre del actor; `null` si no se pudo resolver (p. ej. sistema). */
  actor: string | null;
  /** `CREATE` / `UPDATE` / `DELETE` / `ASSIGN` / `COMPLETE` / `REOPEN`. */
  action: string;
  /** Tipo de entidad afectada (p. ej. `Task`, `Project`). */
  entityType: string;
  createdAt: string;
}

/** Respuesta completa de `GET /dashboard/admin` (métricas globales del espacio). */
export interface AdminDashboard {
  activeProjects: number;
  usersByRole: UsersByRole;
  activeUsers: number;
  /** Últimas ~8 entradas de auditoría, más recientes primero. */
  recentAudit: AuditSummary[];
}

export const dashboardService = {
  /** Panel personal del usuario autenticado (sin params ni body). */
  getMyDashboard: () => api.get<MyDashboard>('/dashboard/me'),

  /** Panel de administración con métricas globales. **Solo ADMIN** (403 para MEMBER). */
  getAdminDashboard: () => api.get<AdminDashboard>('/dashboard/admin'),
};
