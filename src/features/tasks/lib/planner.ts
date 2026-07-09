import { addDays, startOfDay } from './gantt';
import type { Task } from '../services/tasks.service';

/** Cabecera de días de la semana, empezando en **lunes**. */
export const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const;

export interface PlannerDay {
  /** Medianoche local del día. */
  date: Date;
  /** Clave `YYYY-MM-DD` (local) para indexar tareas. */
  key: string;
  /** Número de día del mes (1..31). */
  day: number;
  /** ¿Pertenece al mes visible? (los de relleno se atenúan). */
  inMonth: boolean;
  /** ¿Es hoy? */
  isToday: boolean;
  /** ¿Sábado o domingo? */
  isWeekend: boolean;
}

/** Clave `YYYY-MM-DD` (componentes locales) de una fecha. */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Día efectivo de una tarea en el calendario: su **fecha límite** (`dueDate`) —el hito de
 * planificación— o `startDate` como fallback. `null` si no tiene ninguna fecha. Normaliza a
 * día local (misma convención que el resto de la app vía `startOfDay`).
 */
export function taskCalendarKey(task: Task): string | null {
  const iso = task.dueDate ?? task.startDate;
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return dayKey(startOfDay(d));
}

/** Agrupa las tareas por su día efectivo (`dueDate` || `startDate`). */
export function groupTasksByDay(tasks: Task[]): Map<string, Task[]> {
  const map = new Map<string, Task[]>();
  for (const task of tasks) {
    const key = taskCalendarKey(task);
    if (!key) continue;
    const bucket = map.get(key);
    if (bucket) bucket.push(task);
    else map.set(key, [task]);
  }
  return map;
}

/** Tareas sin ninguna fecha (no caben en el calendario). */
export function undatedTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => !t.dueDate && !t.startDate);
}

/**
 * Construye la grilla del mes en semanas de **lunes a domingo**. Incluye los días de relleno
 * del mes anterior/siguiente para completar las semanas. Recorta la 6ª semana si es
 * completamente de otro mes.
 */
export function buildMonthGrid(year: number, month: number): PlannerDay[][] {
  const first = new Date(year, month, 1);
  // getDay(): 0=Dom..6=Sáb → offset para que la semana empiece en lunes (Lun=0).
  const mondayOffset = (first.getDay() + 6) % 7;
  const today = startOfDay(new Date());

  let cursor = addDays(startOfDay(first), -mondayOffset);
  const weeks: PlannerDay[][] = [];

  for (let w = 0; w < 6; w += 1) {
    const week: PlannerDay[] = [];
    for (let d = 0; d < 7; d += 1) {
      const dow = cursor.getDay();
      week.push({
        date: cursor,
        key: dayKey(cursor),
        day: cursor.getDate(),
        inMonth: cursor.getMonth() === month,
        isToday: cursor.getTime() === today.getTime(),
        isWeekend: dow === 0 || dow === 6,
      });
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }

  if (weeks[5].every((day) => !day.inMonth)) weeks.pop();
  return weeks;
}

/** Etiqueta legible del mes visible (p.ej. "julio de 2026"). */
export function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('es', {
    month: 'long',
    year: 'numeric',
  });
}

/** Avanza/retrocede `delta` meses desde `year`/`month` (0-based). */
export function addMonths(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

/* --------------------------------------------------------------------------
 * Multi-mes (QL-71)
 * ------------------------------------------------------------------------ */

/** Par año/mes (0-based) que identifica un mes del calendario. */
export interface YearMonth {
  year: number;
  month: number;
}

/** Lista de `count` meses consecutivos empezando en `year`/`month` (para la vista multi-mes). */
export function monthsRange(year: number, month: number, count: number): YearMonth[] {
  const out: YearMonth[] = [];
  for (let i = 0; i < Math.max(1, count); i += 1) {
    out.push(addMonths(year, month, i));
  }
  return out;
}

/**
 * Etiqueta del rango visible: un mes → "julio de 2026"; varios → "jul – sep 2026"
 * (añade el año al primer mes solo si difiere del último).
 */
export function rangeLabel(year: number, month: number, count: number): string {
  if (count <= 1) return monthLabel(year, month);
  const first = new Date(year, month, 1);
  const lastYm = addMonths(year, month, count - 1);
  const last = new Date(lastYm.year, lastYm.month, 1);
  const sameYear = first.getFullYear() === last.getFullYear();
  const fmt = (d: Date, withYear: boolean) =>
    d.toLocaleDateString('es', {
      month: 'short',
      ...(withYear ? { year: 'numeric' } : {}),
    });
  return `${fmt(first, !sameYear)} – ${fmt(last, true)}`;
}

/* --------------------------------------------------------------------------
 * Hitos (QL-71)
 * ------------------------------------------------------------------------ */

/** Tipo de hito mostrado en el planner, con estilo propio (no es un chip de tarea). */
export type MilestoneKind =
  | 'project-created'
  | 'project-start'
  | 'project-end'
  | 'task-start'
  | 'task-end';

/** Un evento clave situado en un día del calendario. */
export interface Milestone {
  kind: MilestoneKind;
  /** Etiqueta legible (nombre del hito de proyecto o título de la tarea). */
  label: string;
  /** Día `YYYY-MM-DD` (local) del evento, para indexar por celda. */
  key: string;
  /** id de la tarea asociada (abre su detalle al click), o `null` en hitos de proyecto. */
  taskId: string | null;
}

/** Fechas del proyecto que originan hitos (subconjunto de `Project`; todas opcionales). */
export interface ProjectMilestoneDates {
  createdAt?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

/**
 * Lee de forma **segura** una fecha ISO opcional de una tarea que quizá aún no exista en el
 * tipo `Task` (los campos `startedAt`/`finishedAt` los añade QL-62 en backend). Sin `any`:
 * accede vía `Record<string, unknown>` y valida que sea string no vacía. Devuelve `null` si
 * el campo no viene → el hito de tarea simplemente se omite (degradación elegante).
 */
export function readOptionalTaskDate(
  task: Task,
  key: 'startedAt' | 'finishedAt',
): string | null {
  const value = (task as unknown as Record<string, unknown>)[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Reúne los hitos a mostrar: los del **proyecto** (creado/inicio/fin) y los de **tareas**
 * (inicio `startedAt` / fin `finishedAt`, ambos de QL-62). Las fechas ausentes o inválidas
 * se descartan sin romper. Los hitos de tarea de fin **no** usan `dueDate` como fallback:
 * esa fecha ya está representada por el chip de la tarea (evita duplicar el mismo evento).
 */
export function buildMilestones(
  project: ProjectMilestoneDates | undefined,
  tasks: Task[],
): Milestone[] {
  const list: Milestone[] = [];

  const push = (
    iso: string | null | undefined,
    kind: MilestoneKind,
    label: string,
    taskId: string | null,
  ) => {
    if (!iso) return;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return;
    list.push({ kind, label, key: dayKey(startOfDay(d)), taskId });
  };

  if (project) {
    push(project.createdAt, 'project-created', 'Proyecto creado', null);
    push(project.startDate, 'project-start', 'Inicio del proyecto', null);
    push(project.endDate, 'project-end', 'Fin del proyecto', null);
  }

  for (const task of tasks) {
    push(readOptionalTaskDate(task, 'startedAt'), 'task-start', task.title, task.id);
    push(readOptionalTaskDate(task, 'finishedAt'), 'task-end', task.title, task.id);
  }

  return list;
}

/** Agrupa los hitos por su día (`YYYY-MM-DD`), conservando el orden de inserción. */
export function groupMilestonesByDay(milestones: Milestone[]): Map<string, Milestone[]> {
  const map = new Map<string, Milestone[]>();
  for (const m of milestones) {
    const bucket = map.get(m.key);
    if (bucket) bucket.push(m);
    else map.set(m.key, [m]);
  }
  return map;
}
