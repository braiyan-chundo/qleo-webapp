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
