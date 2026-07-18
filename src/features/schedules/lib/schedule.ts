import type { ResolvedShift, UserSchedule } from '../services/schedules.service';

/**
 * Utilidades **puras** de mallas horarias (QL-162, §3.48). Resuelven, para un día concreto, los
 * turnos que le tocan a un usuario según su malla vigente, replicando la regla del **sábado
 * intermedio** del backend (`SchedulesService.dayWindows`/`isWorkedSaturday`). Sin dependencias
 * de React ni de red: testeable y reutilizable por QL-163.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/** Medianoche local de una fecha (copia nueva; no muta el argumento). */
function atLocalMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** `'YYYY-MM-DD'` → `Date` local a medianoche, o `null` si no parsea. */
export function parseYmdLocal(value: string | null | undefined): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

/**
 * ¿Este sábado se trabaja? Replica `SchedulesService.isWorkedSaturday`: normaliza ancla y
 * sábado a medianoche, cuenta las semanas entre ambos (`round((sat - anchor) / 7 días)`) y es
 * **trabajado sii ese número es PAR** (`|weeks| % 2 === 0`; el ancla es semana 0 → par).
 */
export function isWorkedSaturday(anchor: Date, saturday: Date): boolean {
  const anchorMs = atLocalMidnight(anchor).getTime();
  const saturdayMs = atLocalMidnight(saturday).getTime();
  const weeks = Math.round((saturdayMs - anchorMs) / WEEK_MS);
  return Math.abs(weeks) % 2 === 0;
}

/**
 * Turnos que le tocan a `date` según la malla `schedule` (o `[]` si no hay malla o el día no
 * tiene turnos). Aplica el **sábado intermedio**: si `saturdayAlternate` y el día es sábado,
 * solo devuelve los turnos si ese sábado le toca según el ancla. Sin ancla válida no se puede
 * resolver la paridad → se ocultan los turnos del sábado (coherente con el backend, que exige
 * `saturdayAnchor` cuando `saturdayAlternate` tiene turnos en sábado).
 */
export function shiftsForDay(
  schedule: UserSchedule | null | undefined,
  date: Date,
): ResolvedShift[] {
  if (!schedule) return [];
  const dow = date.getDay(); // 0=Dom … 6=Sáb, misma convención que weekdays
  // `weekdays?.[dow]` (no solo `[dow]?.`): si por lo que sea `weekdays` no viniera (dato del
  // servidor), no reventamos con `undefined[dow]` — devolvemos "sin turnos" en vez de crashear.
  const shifts = schedule.weekdays?.[dow]?.shifts ?? [];
  if (shifts.length === 0) return [];

  if (dow === 6 && schedule.saturdayAlternate) {
    const anchor = parseYmdLocal(schedule.saturdayAnchor);
    if (!anchor || !isWorkedSaturday(anchor, date)) return [];
  }

  return shifts;
}

/** `480` → `"08:00"`. Minutos desde la medianoche local a `HH:MM` (24h). */
export function formatMinutes(minute: number): string {
  const clamped = Math.max(0, Math.min(1440, Math.round(minute)));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** `"08:00 – 12:00"` a partir de un turno. */
export function formatShiftRange(shift: ResolvedShift): string {
  return `${formatMinutes(shift.startMinute)} – ${formatMinutes(shift.endMinute)}`;
}

/** Franja mínima para detectar solapes: id + ventana `[startMinute, endMinute)`. */
export interface ShiftWindow {
  id: string;
  startMinute: number;
  endMinute: number;
}

/** ¿Se solapan dos ventanas del mismo día? `[start,end)`: contiguas (fin==inicio) NO solapan. */
function windowsOverlap(a: ShiftWindow, b: ShiftWindow): boolean {
  return a.startMinute < b.endMinute && b.startMinute < a.endMinute;
}

/**
 * Pre-validación **en cliente** del solape de turnos de un mismo día (QL-163, §3.48). Devuelve
 * el conjunto de ids implicados en **algún** solape, para que el editor de mallas los marque
 * antes de guardar. El backend es la fuente de verdad (`SHIFT_OVERLAP` 409): esto solo evita el
 * viaje y da feedback inmediato. Turnos **contiguos** (el fin de uno == el inicio del otro) NO
 * solapan (ventanas semiabiertas), coherente con el motor de tiempo hábil.
 */
export function overlappingShiftIds(shifts: ShiftWindow[]): Set<string> {
  const overlapping = new Set<string>();
  for (let i = 0; i < shifts.length; i += 1) {
    for (let j = i + 1; j < shifts.length; j += 1) {
      if (windowsOverlap(shifts[i], shifts[j])) {
        overlapping.add(shifts[i].id);
        overlapping.add(shifts[j].id);
      }
    }
  }
  return overlapping;
}
