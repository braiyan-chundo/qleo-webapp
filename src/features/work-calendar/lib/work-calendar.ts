/**
 * Utilidades del calendario laboral (QL-69). Fechas locales por día (medianoche), fin de
 * semana **configurable** vía `weekendDays` (0=Dom … 6=Sáb) y conteo de días laborables.
 * Un día es **laborable** si su día de la semana no está en `weekendDays` y no cae en un
 * festivo (AUTO o MANUAL). Todo puro/sin dependencias para poder testear y reutilizar.
 */

/** Nombre corto del día por índice `getDay()` (0=Dom … 6=Sáb). */
export const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;

/** Cabecera de la grilla, semana empezando en **lunes** (coherente con Planner/Gantt). */
export const WEEKDAY_HEADERS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const;

/** Orden de selección de días para el panel de config (lunes primero); valor = `getDay()`. */
export const SELECTABLE_WEEKDAYS: { value: number; label: string }[] = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' },
];

/** `yyyy-mm-dd` (componentes locales) — misma clave que usa el backend de festivos. */
export function ymd(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** ¿El día de la semana `dow` (0=Dom … 6=Sáb) es fin de semana según la config? */
export function isWeekendDow(dow: number, weekendDays: number[]): boolean {
  return weekendDays.includes(dow);
}

/** Par año/mes (0-based). */
export interface YearMonth {
  year: number;
  month: number;
}

/** Todos los meses (inclusive) entre `from` y `to`. Con tope de seguridad de 60 meses. */
export function monthsInRange(from: Date, to: Date): YearMonth[] {
  const out: YearMonth[] = [];
  let year = from.getFullYear();
  let month = from.getMonth();
  const endYear = to.getFullYear();
  const endMonth = to.getMonth();

  while (year < endYear || (year === endYear && month <= endMonth)) {
    out.push({ year, month });
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
    if (out.length >= 60) break;
  }
  return out;
}

/** Años distintos que abarca el rango (inclusive). */
export function yearsInRange(from: Date, to: Date): number[] {
  const out: number[] = [];
  for (let y = from.getFullYear(); y <= to.getFullYear(); y += 1) out.push(y);
  return out;
}

/** Celda de día en la grilla mensual. */
export interface CalendarDay {
  key: string;
  day: number;
  dow: number;
  inMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
}

/** Construye la grilla del mes en semanas de **lunes a domingo** con relleno del mes vecino. */
export function buildMonthGrid(
  year: number,
  month: number,
  weekendDays: number[],
): CalendarDay[][] {
  const first = new Date(year, month, 1);
  const mondayOffset = (first.getDay() + 6) % 7; // getDay 0=Dom..6=Sáb → Lun=0
  const now = new Date();
  const todayKey = ymd(now.getFullYear(), now.getMonth(), now.getDate());

  let cursor = new Date(year, month, 1 - mondayOffset);
  const weeks: CalendarDay[][] = [];

  for (let w = 0; w < 6; w += 1) {
    const week: CalendarDay[] = [];
    for (let d = 0; d < 7; d += 1) {
      const y = cursor.getFullYear();
      const mo = cursor.getMonth();
      const da = cursor.getDate();
      const key = ymd(y, mo, da);
      const dow = cursor.getDay();
      week.push({
        key,
        day: da,
        dow,
        inMonth: mo === month,
        isToday: key === todayKey,
        isWeekend: isWeekendDow(dow, weekendDays),
      });
      cursor = new Date(y, mo, da + 1);
    }
    weeks.push(week);
  }

  if (weeks[5].every((c) => !c.inMonth)) weeks.pop();
  return weeks;
}

/** Nº de días laborables de un mes (no fin de semana y no festivo). */
export function countWorkingDaysInMonth(
  year: number,
  month: number,
  weekendDays: number[],
  holidayKeys: Set<string>,
): number {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let count = 0;
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dow = new Date(year, month, day).getDay();
    if (isWeekendDow(dow, weekendDays)) continue;
    if (holidayKeys.has(ymd(year, month, day))) continue;
    count += 1;
  }
  return count;
}

/** Nº de días laborables de un año completo. */
export function countWorkingDaysInYear(
  year: number,
  weekendDays: number[],
  holidayKeys: Set<string>,
): number {
  let total = 0;
  for (let month = 0; month < 12; month += 1) {
    total += countWorkingDaysInMonth(year, month, weekendDays, holidayKeys);
  }
  return total;
}

/** Etiqueta legible del mes (p.ej. "julio de 2026"). */
export function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('es', {
    month: 'long',
    year: 'numeric',
  });
}
