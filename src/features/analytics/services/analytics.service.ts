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
}

/**
 * P5 (§3.24) — análisis detallado de UNA tarea. `timePerColumn` usa **reloj de pared** (tiempo
 * de estancia); el **tiempo hábil** solo aparece en `current.workedMs`.
 */
export interface TaskAnalytics {
  taskId: string;
  projectId: string;
  title: string;
  /** Reutiliza el shape de 2.4 (columnas con 0 incluidas; orden = `order` de columna). */
  timePerColumn: TimePerColumnEntry[];
  current: TaskCurrentStats;
}

/**
 * (QL-200, §3.72 §3) Hacia dónde se mueve el cumplimiento de una persona. Lo resuelve el
 * **backend** con una banda muerta de ±5 puntos; el front **no lo recalcula**.
 *
 * `INSUFFICIENT_DATA` (alguna de las dos ventanas sin muestra) **no es «estable»**: se pinta
 * como ausencia de dato, sin flecha y sin cero.
 */
export type ComplianceTrendDirection =
  | 'IMPROVING'
  | 'WORSENING'
  | 'STABLE'
  | 'INSUFFICIENT_DATA';

/**
 * (QL-200, §3.72 §3) Recuento de una ventana de compromisos **ya juzgables**.
 *
 * `rate` es **`null` cuando `sample` es 0** — ni 0 ni 100. Es la misma disciplina que
 * `complianceRate`: sin muestra no hay porcentaje.
 */
export interface ComplianceWindow {
  /** Compromisos juzgables de la ventana (el denominador). */
  sample: number;
  /** De esos, entregados dentro de plazo. */
  onTime: number;
  /** De esos, incumplidos (tarde, o vencidos y aún abiertos). */
  breached: number;
  /** `round(onTime / sample × 100)`, o **`null`** si `sample === 0`. */
  rate: number | null;
}

/**
 * (QL-200, §3.72 §3) Tendencia del cumplimiento: los últimos `windowDays` días contra los
 * `windowDays` anteriores, anclando cada compromiso en su **`dueDate`** (el periodo en que
 * *vencía*, no en el que se cerró).
 */
export interface ComplianceTrend {
  /** Tamaño de cada ventana en días (hoy 30). */
  windowDays: number;
  /** Ventana reciente. */
  current: ComplianceWindow;
  /** Ventana anterior, del mismo tamaño: la referencia de la comparación. */
  previous: ComplianceWindow;
  /** `current.rate − previous.rate` en **puntos**; `null` si alguna ventana está vacía. */
  deltaPoints: number | null;
  /** Ya resuelto por el backend (banda muerta ±5 pts). **No lo recalcules.** */
  direction: ComplianceTrendDirection;
}

/**
 * P6 (§3.24) — perfil de rendimiento por usuario. Todos los tiempos en **ms**. `avgDurationMs`
 * es tiempo **hábil**; `avgDelayMs` es **reloj de pared**. `efficiency` 0–100 (puntualidad ×
 * avance), la calcula el backend y el front la muestra tal cual.
 *
 * ⚠️ (QL-200, §3.72 §1) **Asimetría heredada.** Los campos anteriores a QL-200 (`assignedTasks`,
 * `completedTasks`, `onTime`, `late`, `efficiency`) **incluyen las tareas descartadas**; los
 * nuevos (`pending*`, `overdueTasks`, `compliance*`) **no**. Consecuencia práctica:
 * `pendingTasks + completedTasks` **no** tiene por qué sumar `assignedTasks`, así que estos
 * números no se pueden presentar como el desglose de un total.
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
  /**
   * 0–100 (a-tiempo × **avance**). **NO es el «% de cumplimiento»** (QL-200): mezcla puntualidad
   * con volumen entregado, ignora la tarea vencida y aún abierta, y vale **0 cuando no hay
   * datos**. Para el listón que pidió el cliente, {@link UserPerformance.complianceRate}.
   */
  efficiency: number;

  // ───────────────────────── QL-200 (§3.72) — aditivo ─────────────────────────

  /** Tareas donde es Responsable, **sin completar y sin descartar**: lo que tiene encima hoy. */
  pendingTasks: number;
  /** De las pendientes, las que ya pasaron su `dueDate`. */
  overdueTasks: number;
  /**
   * De las pendientes, las que **no tienen fecha de fin** y por tanto no son juzgables. Es la
   * **explicación** de un cumplimiento nulo o no fiable: sin esto, el hueco parece un fallo o,
   * peor, una acusación.
   */
  pendingWithoutDueDate: number;
  /**
   * **% de cumplimiento** (§3.72 §0): de los compromisos con fecha ya juzgables, cuántos se
   * entregaron en plazo.
   *
   * ⚠️ **`null` no es 0.** `null` significa que no hay ni un compromiso que juzgar. Convertirlo
   * con `?? 0` —o dejar que ordene como un cero— convierte «no se puede medir» en «lo hace fatal»
   * en una pantalla que lee su jefe.
   */
  complianceRate: number | null;
  /** Denominador de `complianceRate`: compromisos juzgables. Se enseña **junto** al porcentaje. */
  complianceSample: number;
  /** De la muestra, los entregados en plazo (numerador). */
  complianceOnTime: number;
  /** De la muestra, los incumplidos. Siempre `complianceOnTime + complianceBreached === complianceSample`. */
  complianceBreached: number;
  /**
   * `complianceSample >= complianceMinSample` (el mismo listón que usa el cron de alertas y que
   * Dirección edita en `GET|PATCH /settings/management-alerts`).
   *
   * ⚠️ **En `false` no se pinta el porcentaje.** Hoy sale `false` para *todos* los usuarios del
   * clon de producción (solo 4 de 64 tareas tienen fecha de fin), así que este es el caso normal,
   * no el borde.
   */
  complianceReliable: boolean;
  /** Tendencia 30 d vs. los 30 anteriores, ya resuelta por el backend. */
  complianceTrend: ComplianceTrend;
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
  /**
   * Rendimiento por usuario (`GET /analytics/users`, **Dirección**; §3.24 P6 + §3.72 QL-200).
   * Array plano ordenado por `efficiency` desc; QL-200 solo **añadió** campos.
   */
  getUsersPerformance: () => api.get<UserPerformance[]>('/analytics/users'),
};
