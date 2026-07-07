import type { Task } from '../services/tasks.service';
import type { Stage } from '@/features/stages/services/stages.service';

/**
 * Utilidades de posicionamiento temporal del Gantt (QL — vista cronograma). Todo el cálculo
 * trabaja en **días enteros** (medianoche local): convertimos las fechas ISO a un índice de
 * día relativo al inicio del rango, y la posición/anchura de cada barra se expresa como
 * porcentaje sobre el total de días. No hay dependencia de librerías de charting.
 */

/** Milisegundos en un día. */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Fecha a medianoche local (descarta la hora, para contar días completos). */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Nº de días completos entre dos fechas (a medianoche local). Puede ser negativo. */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY);
}

/** Suma `n` días a una fecha (nueva instancia, a medianoche local). */
export function addDays(date: Date, n: number): Date {
  const d = startOfDay(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** ISO válido → `Date`, o `null` si falta o es inválido. */
function parseIso(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Fechas efectivas de una tarea (a medianoche local), o `null` cada extremo si no aplica. */
export interface TaskDates {
  start: Date | null;
  due: Date | null;
}

/** Extrae y normaliza (a día) las fechas de una tarea. */
export function taskDates(task: Task): TaskDates {
  const start = parseIso(task.startDate);
  const due = parseIso(task.dueDate);
  return {
    start: start ? startOfDay(start) : null,
    due: due ? startOfDay(due) : null,
  };
}

/** ¿La tarea tiene al menos una fecha (inicio o límite)? */
export function hasSchedule(task: Task): boolean {
  return !!task.startDate || !!task.dueDate;
}

/** Rango temporal [min, max] (a día) del cronograma, con padding en los extremos. */
export interface GanttRange {
  /** Primer día visible (medianoche local). */
  start: Date;
  /** Último día visible (medianoche local, inclusivo). */
  end: Date;
  /** Nº total de días visibles (>= 1). */
  totalDays: number;
}

/**
 * Calcula el rango del cronograma a partir de las tareas con fecha: `min(start||due)` …
 * `max(due||start)`, con un padding de `padDays` a cada lado. Devuelve `null` si ninguna
 * tarea tiene fecha (estado vacío). El rango es **inclusivo** en ambos extremos.
 */
export function computeRange(tasks: Task[], padDays = 2): GanttRange | null {
  let min: Date | null = null;
  let max: Date | null = null;

  for (const task of tasks) {
    const { start, due } = taskDates(task);
    const lo = start ?? due;
    const hi = due ?? start;
    if (lo && (!min || lo < min)) min = lo;
    if (hi && (!max || hi > max)) max = hi;
  }

  if (!min || !max) return null;

  const start = addDays(min, -padDays);
  const end = addDays(max, padDays);
  const totalDays = daysBetween(start, end) + 1; // inclusivo
  return { start, end, totalDays: Math.max(1, totalDays) };
}

/** Posición y anchura de una barra, en porcentaje (0..100) sobre el rango total. */
export interface BarGeometry {
  /** Offset izquierdo en % desde el inicio del rango. */
  leftPct: number;
  /** Anchura en % del rango total. */
  widthPct: number;
  /** `true` si es un hito (solo una fecha): se pinta como rombo, no como barra. */
  milestone: boolean;
}

/**
 * Geometría de la barra de una tarea sobre el rango dado:
 * - Ambas fechas → barra de `start` (inclusive) a `due` (inclusive): anchura = díasEntre + 1.
 * - Solo `due` o solo `start` → hito de 1 día (`milestone: true`) en esa fecha.
 * Devuelve `null` si la tarea no tiene ninguna fecha.
 * El % se calcula como `(offsetDías / totalDías) * 100`, con clamp a [0, 100].
 */
export function barGeometry(task: Task, range: GanttRange): BarGeometry | null {
  const { start, due } = taskDates(task);
  const anchor = start ?? due;
  if (!anchor) return null;

  const both = !!start && !!due;
  const from = start ?? due!;
  const to = due ?? start!;

  const startOffset = daysBetween(range.start, from);
  // +1 porque los extremos son inclusivos (una tarea de un solo día ocupa 1 día completo).
  const spanDays = both ? daysBetween(from, to) + 1 : 1;

  const rawLeft = (startOffset / range.totalDays) * 100;
  const rawWidth = (spanDays / range.totalDays) * 100;

  const leftPct = Math.min(100, Math.max(0, rawLeft));
  const widthPct = Math.min(100 - leftPct, Math.max(0, rawWidth));

  return { leftPct, widthPct, milestone: !both };
}

/** Posición en % de la línea "Hoy" dentro del rango, o `null` si hoy cae fuera. */
export function todayMarkerPct(range: GanttRange): number | null {
  const today = startOfDay(new Date());
  if (today < range.start || today > range.end) return null;
  const offset = daysBetween(range.start, today);
  return (offset / range.totalDays) * 100;
}

/** Una celda del encabezado temporal (un día o una semana), con su posición en %. */
export interface HeaderCell {
  /** Etiqueta a mostrar (día del mes, o "d mmm" al inicio de semana/mes). */
  label: string;
  /** Sub-etiqueta opcional (mes) para el primer día del mes. */
  subLabel?: string;
  /** Offset izquierdo en % del rango. */
  leftPct: number;
  /** Anchura en % del rango (1 día, o 7 días agrupados). */
  widthPct: number;
  /** `true` si esta celda representa "hoy" (solo en modo día). */
  isToday: boolean;
  /** `true` para fin de semana (sábado/domingo), para atenuar el fondo (solo modo día). */
  isWeekend: boolean;
  /** Clave estable para React. */
  key: string;
}

/** Unidad del encabezado: por día (rangos cortos) o por semana (rangos largos). */
export type HeaderUnit = 'day' | 'week';

/** Umbral de días por encima del cual el encabezado se agrupa por semanas. */
export const WEEK_HEADER_THRESHOLD = 60;

/** Elige la unidad del encabezado según el tamaño del rango. */
export function headerUnit(range: GanttRange): HeaderUnit {
  return range.totalDays > WEEK_HEADER_THRESHOLD ? 'week' : 'day';
}

const MONTHS_ES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

/**
 * Construye las celdas del encabezado temporal. En modo `day` una celda por día (con marca de
 * fin de semana y de hoy); en modo `week` una celda por semana (7 días), etiquetada por su
 * primer día. Las anchuras siempre son proporcionales al rango total (barras alineadas).
 */
export function buildHeaderCells(range: GanttRange, unit: HeaderUnit): HeaderCell[] {
  const today = startOfDay(new Date());
  const cells: HeaderCell[] = [];

  if (unit === 'day') {
    for (let i = 0; i < range.totalDays; i += 1) {
      const day = addDays(range.start, i);
      const dow = day.getDay();
      const isFirstOfMonth = day.getDate() === 1 || i === 0;
      cells.push({
        label: String(day.getDate()),
        subLabel: isFirstOfMonth ? MONTHS_ES[day.getMonth()] : undefined,
        leftPct: (i / range.totalDays) * 100,
        widthPct: (1 / range.totalDays) * 100,
        isToday: day.getTime() === today.getTime(),
        isWeekend: dow === 0 || dow === 6,
        key: `d-${i}`,
      });
    }
    return cells;
  }

  // Modo semana: agrupa de 7 en 7 días desde el inicio del rango.
  for (let i = 0; i < range.totalDays; i += 7) {
    const day = addDays(range.start, i);
    const span = Math.min(7, range.totalDays - i);
    cells.push({
      label: `${day.getDate()} ${MONTHS_ES[day.getMonth()]}`,
      leftPct: (i / range.totalDays) * 100,
      widthPct: (span / range.totalDays) * 100,
      isToday: false,
      isWeekend: false,
      key: `w-${i}`,
    });
  }
  return cells;
}

/** Una sección del Gantt: una etapa (o "Sin programar") con sus tareas ya repartidas. */
export interface GanttSection {
  /** `id` de la etapa, o `'__unscheduled__'` para la sección final. */
  id: string;
  /** Nombre a mostrar. */
  name: string;
  /** Tareas con fecha (se dibuja barra/hito). */
  scheduled: Task[];
  /** Tareas sin ninguna fecha (lista simple, sin barra). */
  unscheduled: Task[];
}

/** Id sentinela de la sección "Sin programar" (tareas sin fecha ni etapa reconocida). */
export const UNSCHEDULED_SECTION_ID = '__unscheduled__';

/**
 * Agrupa las tareas por etapa (en el `order` de `stages`). Las tareas **sin fecha** van a una
 * sección final "Sin programar". Dentro de cada etapa, las tareas con fecha se ordenan por su
 * fecha de inicio efectiva (`start||due`) ascendente. Solo se devuelven secciones no vacías.
 */
export function buildSections(tasks: Task[], stages: Stage[]): GanttSection[] {
  const stageOrder = [...stages].sort((a, b) => a.order - b.order);

  const scheduledByStage = new Map<string, Task[]>();
  const unscheduled: Task[] = [];

  for (const task of tasks) {
    if (!hasSchedule(task)) {
      unscheduled.push(task);
      continue;
    }
    const list = scheduledByStage.get(task.stageId) ?? [];
    list.push(task);
    scheduledByStage.set(task.stageId, list);
  }

  const effectiveStart = (t: Task): number => {
    const { start, due } = taskDates(t);
    const d = start ?? due;
    return d ? d.getTime() : Number.POSITIVE_INFINITY;
  };

  const sections: GanttSection[] = [];

  for (const stage of stageOrder) {
    const scheduled = (scheduledByStage.get(stage.id) ?? []).sort(
      (a, b) => effectiveStart(a) - effectiveStart(b),
    );
    if (scheduled.length > 0) {
      sections.push({ id: stage.id, name: stage.name, scheduled, unscheduled: [] });
    }
  }

  // Tareas programadas cuya etapa no está en `stages` (borde raro): sección propia al final
  // de las etapas conocidas, para no perderlas del cronograma.
  const knownStageIds = new Set(stageOrder.map((s) => s.id));
  const orphanScheduled: Task[] = [];
  for (const [stageId, list] of scheduledByStage) {
    if (!knownStageIds.has(stageId)) orphanScheduled.push(...list);
  }
  if (orphanScheduled.length > 0) {
    sections.push({
      id: '__orphan__',
      name: 'Otras',
      scheduled: orphanScheduled.sort((a, b) => effectiveStart(a) - effectiveStart(b)),
      unscheduled: [],
    });
  }

  if (unscheduled.length > 0) {
    sections.push({
      id: UNSCHEDULED_SECTION_ID,
      name: 'Sin programar',
      scheduled: [],
      unscheduled,
    });
  }

  return sections;
}
