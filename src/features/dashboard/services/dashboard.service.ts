import { api } from '@/core/api/fetch-client';

/**
 * DTOs del endpoint de agregación del dashboard personal (QL-18/QL-19, §3.14).
 * Todo es **solo lectura**: agrega tareas, proyecto foco y menciones del usuario
 * autenticado en una sola llamada.
 *
 * (QL-130) El backend sigue enviando `activeTimer`, pero el front ya no lo tipa ni lo
 * pinta: el ciclo activo se calcula solo, no se activa a mano, y la tarjeta confundía.
 * Los campos de más en la respuesta se ignoran sin problema.
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
  /** ObjectId del actor (QL-111). Para enlazar a su perfil. */
  actorId: string;
  /**
   * Proxy privado del avatar del actor (`/users/<actorId>/avatar`) o `null` (QL-111).
   * Se resuelve con el mismo flujo blob+Bearer del resto de avatares → usar `AuthedAvatar`.
   */
  actorAvatarUrl: string | null;
  /** `CREATE` / `UPDATE` / `DELETE` / `ASSIGN` / `COMPLETE` / `REOPEN`. */
  action: string;
  /**
   * Tipo de entidad afectada en **MAYÚSCULA singular** (§3.14): `TASK`, `PROJECT`,
   * `USER`, `COLUMN`, `ATTACHMENT`, `WALL`, `PUSH`… (⚠️ no es `Task`/`Project`).
   */
  entityType: string;
  /**
   * Nombre/título real de la entidad (QL-111), o `null` si fue borrada o el tipo no
   * tiene nombre legible (p. ej. `WALL`, `PUSH`).
   */
  entityName: string | null;
  createdAt: string;
}

/** Conteo global de tareas por estado (QL-111). `overdue` es subconjunto de `open`. */
export interface TasksByStatus {
  open: number;
  closed: number;
  /** Sin cerrar con `dueDate < ahora`. **No** sumar con open/closed (ya está dentro de open). */
  overdue: number;
}

/** Conteo de proyectos por `status` derivado (QL-111 / QL-37). Los 4 suman el total. */
export interface ProjectsByStatus {
  PLANNING: number;
  ACTIVE: number;
  CLOSING: number;
  COMPLETED: number;
}

/** Punto de throughput semanal (QL-111): tareas cerradas por semana. 12 semanas asc. */
export interface ThroughputPoint {
  /** Lunes ISO de la semana en `YYYY-MM-DD` (UTC). */
  weekStart: string;
  closed: number;
}

/** Punto de actividad diaria (QL-111): entradas de auditoría por día. 14 días asc. */
export interface ActivityPoint {
  /** Día en `YYYY-MM-DD` (UTC). */
  day: string;
  count: number;
}

/** Respuesta completa de `GET /dashboard/admin` (métricas globales del espacio). */
export interface AdminDashboard {
  activeProjects: number;
  usersByRole: UsersByRole;
  activeUsers: number;
  /** Últimas ~8 entradas de auditoría, más recientes primero. */
  recentAudit: AuditSummary[];
  /** QL-111: conteo global de tareas por estado (open/closed/overdue). */
  tasksByStatus: TasksByStatus;
  /** QL-111: conteo de proyectos por estado derivado. */
  projectsByStatus: ProjectsByStatus;
  /** QL-111: tareas cerradas por semana (12 semanas asc, huecos en 0). */
  throughput: ThroughputPoint[];
  /** QL-111: actividad de auditoría por día (14 días asc, huecos en 0). */
  activityByDay: ActivityPoint[];
}

export const dashboardService = {
  /** Panel personal del usuario autenticado (sin params ni body). */
  getMyDashboard: () => api.get<MyDashboard>('/dashboard/me'),

  /** Panel de administración con métricas globales. **Solo ADMIN** (403 para MEMBER). */
  getAdminDashboard: () => api.get<AdminDashboard>('/dashboard/admin'),
};
