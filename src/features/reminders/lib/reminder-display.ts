import type {
  ReminderKind,
  ReminderOccurrenceDto,
  ReminderResponseDto,
  ReminderScheduleResponse,
  SkipReason,
} from '../types/reminder.types';
import {
  bogotaToday,
  formatCivilDay,
  formatCivilDayMonth,
  toBogotaCivil,
} from './bogota-time';

/**
 * Lo que la pantalla de recordatorios **dice** de cada uno (HU-0202): grupo, resumen de la
 * programación y lectura de la vista previa. Puro: no recalcula el calendario ni el estado de la
 * tarea; todo sale de lo que devuelve la API (§3.74).
 */

/** Topes del contrato (§3.74 §4, T-9). Los vuelve a imponer el servidor. */
export const REMINDER_LIMIT = 100;
export const MAX_DATE_SLOTS = 50;
export const MESSAGE_MAX_LENGTH = 200;
/** Ningún par nuevo puede caer más allá de hoy + 366 días (B-1). */
export const MAX_DAYS_AHEAD = 366;
/** Máximo de horas en «Cada N horas» (D-6). */
export const MAX_EVERY_HOURS = 12;

/** Orden de la semana en pantalla: de lunes a domingo (contrato: 0 = domingo … 6 = sábado). */
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export const WEEKDAY_SHORT: Record<number, string> = {
  0: 'dom',
  1: 'lun',
  2: 'mar',
  3: 'mié',
  4: 'jue',
  5: 'vie',
  6: 'sáb',
};

export const WEEKDAY_FULL: Record<number, string> = {
  0: 'domingo',
  1: 'lunes',
  2: 'martes',
  3: 'miércoles',
  4: 'jueves',
  5: 'viernes',
  6: 'sábado',
};

export const KIND_LABELS: Record<ReminderKind, string> = {
  ONCE: 'Una vez',
  DAILY: 'Todos los días',
  WEEKLY: 'Días de la semana',
  DATES: 'Fechas sueltas',
  INTERVAL: 'Cada N horas',
};

/** Orden de los tipos en el formulario (maqueta). */
export const KIND_ORDER: readonly ReminderKind[] = ['ONCE', 'DAILY', 'WEEKLY', 'DATES', 'INTERVAL'];

export type ReminderGroup = 'active' | 'paused' | 'done';

/**
 * Grupo de la lista (§3.74 §2): `FINISHED` → Cumplidos; `PAUSED` **o** `blockedReason` → En
 * pausa; si no, Activos. El estado de la tarea no se deriva aquí: lo dice `blockedReason`.
 */
export function reminderGroup(reminder: Pick<ReminderResponseDto, 'status' | 'blockedReason'>): ReminderGroup {
  if (reminder.status === 'FINISHED') return 'done';
  if (reminder.status === 'PAUSED' || reminder.blockedReason) return 'paused';
  return 'active';
}

/** Reparte la lista en sus tres grupos **conservando el orden del servidor** (A-2). */
export function groupReminders<T extends Pick<ReminderResponseDto, 'status' | 'blockedReason'>>(
  reminders: readonly T[],
): Record<ReminderGroup, T[]> {
  const groups: Record<ReminderGroup, T[]> = { active: [], paused: [], done: [] };
  for (const reminder of reminders) groups[reminderGroup(reminder)].push(reminder);
  return groups;
}

/**
 * Cómo terminó un cumplido: «Cumplido» si sonó al menos una vez; «No sonó» si todos sus pares
 * se omitieron (D-10, AC-31, AC-35).
 */
export function finishedOutcome(schedule: ReminderScheduleResponse): 'FIRED' | 'MISSED' {
  const slots = schedule.slots ?? [];
  return slots.some((slot) => slot.result === 'FIRED') ? 'FIRED' : 'MISSED';
}

function sortWeekdays(days: readonly number[]): number[] {
  return WEEKDAY_ORDER.filter((day) => days.includes(day));
}

function capitalize(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/** Une en español: «a», «a y b», «a, b y c». */
export function joinWithAnd(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}

/** `[1, 3, 5]` → «lun, mié, vie» (de lunes a domingo). */
export function formatWeekdayList(days: readonly number[]): string {
  return sortWeekdays(days)
    .map((day) => WEEKDAY_SHORT[day])
    .join(', ');
}

/**
 * Días de «Cada N horas»: «lun-vie» si son tres o más seguidos; «todos los días» con los siete;
 * si no, la lista («lun, mié, vie»).
 */
export function formatWeekdayRange(days: readonly number[]): string {
  const sorted = sortWeekdays(days);
  if (sorted.length === 7) return 'todos los días';
  const positions = sorted.map((day) => WEEKDAY_ORDER.indexOf(day as (typeof WEEKDAY_ORDER)[number]));
  const contiguous = positions.every((pos, i) => i === 0 || pos === positions[i - 1] + 1);
  if (sorted.length >= 3 && contiguous) {
    return `${WEEKDAY_SHORT[sorted[0]]}-${WEEKDAY_SHORT[sorted[sorted.length - 1]]}`;
  }
  return formatWeekdayList(sorted);
}

/** Fechas de un cumplido de fechas sueltas: «6 y 13 oct» · «28 oct y 4 nov». */
function formatDatesList(dates: readonly string[]): string {
  const groups: { month: string; days: string[] }[] = [];
  for (const date of [...dates].sort()) {
    const [day, month] = formatCivilDayMonth(date).split(' ');
    const last = groups[groups.length - 1];
    if (last && last.month === month) last.days.push(day);
    else groups.push({ month, days: [day] });
  }
  return joinWithAnd(groups.map((g) => `${joinWithAnd(g.days)} ${g.month}`));
}

/**
 * Resumen de la programación para la fila (AC-02…AC-06): «Una vez» · «Todos los días · 08:15» ·
 * «Lun, mié, vie · 09:30» · «3 fechas» · «Cada 2 h · 08:00-18:00 · lun-vie». Los cumplidos dicen
 * cuándo fue («Una vez · vie 16 oct, 10:00», «2 fechas · 6 y 13 oct»). Las casillas marcadas se
 * añaden al final.
 */
export function scheduleSummary(
  reminder: Pick<
    ReminderResponseDto,
    'schedule' | 'status' | 'soundOnNonWorkingDays' | 'soundOutsideWorkingHours'
  >,
  today: string = bogotaToday(),
): string {
  const { schedule, status } = reminder;
  const slots = schedule.slots ?? [];
  let base: string;

  switch (schedule.kind) {
    case 'ONCE': {
      const slot = slots[0];
      base =
        status === 'FINISHED' && slot
          ? `Una vez · ${formatCivilDay(slot.date, today)}, ${slot.time}`
          : 'Una vez';
      break;
    }
    case 'DATES': {
      const count = slots.length;
      base = `${count} ${count === 1 ? 'fecha' : 'fechas'}`;
      if (status === 'FINISHED' && count > 0 && count <= 4) {
        base += ` · ${formatDatesList(slots.map((slot) => slot.date))}`;
      }
      break;
    }
    case 'WEEKLY':
      base = `${capitalize(formatWeekdayList(schedule.weekdays ?? []))} · ${schedule.time ?? ''}`;
      break;
    case 'DAILY':
      base = `Todos los días · ${schedule.time ?? ''}`;
      break;
    case 'INTERVAL':
      base = `Cada ${schedule.everyHours ?? ''} h · ${schedule.startTime ?? ''}-${schedule.endTime ?? ''} · ${formatWeekdayRange(schedule.weekdays ?? [])}`;
      break;
    default:
      base = '';
  }

  const extras: string[] = [];
  if (reminder.soundOnNonWorkingDays) extras.push('también en días no laborales');
  if (reminder.soundOutsideWorkingHours) extras.push('también fuera del horario');
  return [base, ...extras].join(' · ');
}

/* ------------------------------------------------------------------------------------------ */
/* Vista previa                                                                                */
/* ------------------------------------------------------------------------------------------ */

export const SKIP_REASON_LABELS: Record<SkipReason, string> = {
  NON_WORKING_DAY: 'día no laboral',
  OUTSIDE_WORKING_HOURS: 'fuera de tu horario',
};

export interface PreviewTime {
  time: string;
  skipped: SkipReason | null;
}

export interface PreviewDay {
  date: string;
  times: PreviewTime[];
  /** Motivo del primer aviso omitido del día, o `null` si suenan todos. */
  skipped: SkipReason | null;
}

/** Agrupa las ocurrencias por día civil de Bogotá, en el orden en que llegan. */
export function groupPreviewByDay(occurrences: readonly ReminderOccurrenceDto[]): PreviewDay[] {
  const days: PreviewDay[] = [];
  for (const occurrence of occurrences) {
    const { date, time } = toBogotaCivil(occurrence.at);
    let day = days[days.length - 1];
    if (!day || day.date !== date) {
      day = { date, times: [], skipped: null };
      days.push(day);
    }
    day.times.push({ time, skipped: occurrence.skipped });
    if (occurrence.skipped && !day.skipped) day.skipped = occurrence.skipped;
  }
  return days;
}

/** Motivo de omisión del par `date`+`time` en la vista previa, si sale en ella. */
export function skipForSlot(
  occurrences: readonly ReminderOccurrenceDto[],
  date: string,
  time: string,
): SkipReason | null {
  for (const occurrence of occurrences) {
    const civil = toBogotaCivil(occurrence.at);
    if (civil.date === date && civil.time === time) return occurrence.skipped;
  }
  return null;
}

/** ¿Algún aviso a la hora `time` se omite por caer fuera del horario laboral? (AC-38) */
export function skipsOutsideHoursAt(
  occurrences: readonly ReminderOccurrenceDto[],
  time: string,
): boolean {
  return occurrences.some(
    (o) => o.skipped === 'OUTSIDE_WORKING_HOURS' && toBogotaCivil(o.at).time === time,
  );
}

/** ¿Algún aviso se omite por caer fuera del horario laboral? (AC-38, por hora en todos los tipos) */
export function anySkippedOutsideHours(occurrences: readonly ReminderOccurrenceDto[]): boolean {
  return occurrences.some((o) => o.skipped === 'OUTSIDE_WORKING_HOURS');
}

/**
 * Pie de la vista previa (maqueta). `null` en «Una vez». Los recurrentes cuentan sobre los
 * avisos de los próximos 14 días que devolvió el servidor.
 */
export function previewFooter(
  kind: ReminderKind,
  occurrences: readonly ReminderOccurrenceDto[],
  truncated: boolean,
): string | null {
  const total = occurrences.length;
  const sounding = occurrences.filter((o) => !o.skipped).length;
  const skipped = total - sounding;

  if (kind === 'ONCE' || total === 0) return null;

  if (kind === 'INTERVAL') {
    if (truncated) return `Se muestran los primeros ${total} avisos de los próximos 14 días.`;
    return sounding === total ? `Suenan los ${total}.` : `Suenan ${sounding} de ${total}.`;
  }

  if (kind === 'DATES') {
    if (sounding === total) {
      return total === 1
        ? 'Suena la fecha. Después, queda «Cumplido».'
        : `Suenan las ${total}. Después de la última, queda «Cumplido».`;
    }
    return `${sounding === 1 ? 'Suena' : 'Suenan'} ${sounding} de ${total}.`;
  }

  // DAILY y WEEKLY
  if (sounding === total) return `Suenan los ${total}.`;
  if (sounding === 0) {
    return kind === 'DAILY'
      ? `Ninguno de los ${total} avisos sonaría con esta hora.`
      : `Ninguno de los ${total} avisos sonaría.`;
  }
  const reasons = new Set(occurrences.filter((o) => o.skipped).map((o) => o.skipped));
  if (reasons.size === 1) {
    const reason = [...reasons][0] as SkipReason;
    const where = reason === 'NON_WORKING_DAY' ? 'en días no laborales' : 'fuera de tu horario';
    return `Suenan ${sounding} de ${total}; se omiten ${skipped} ${where}.`;
  }
  return `Suenan ${sounding} de ${total}.`;
}
