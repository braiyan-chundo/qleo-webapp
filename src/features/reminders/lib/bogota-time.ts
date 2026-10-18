/**
 * Hora de Bogotá para los recordatorios (HU-0202, D-3, §3.74 §1). Todo es `America/Bogota`
 * (UTC-5 fijo, sin horario de verano) **sin importar la zona del dispositivo**:
 *
 * - Lo que elige la persona viaja como texto civil (`'YYYY-MM-DD'` + `'HH:mm'`); nunca se
 *   convierte con `toISOString()`.
 * - Los instantes que devuelve la API (`nextFireAt`, `occurrences[].at`) se leen con
 *   `Intl.DateTimeFormat` y `timeZone: 'America/Bogota'`.
 * - La aritmética de días civiles se hace en UTC puro (`Date.UTC`), que no tiene saltos.
 *
 * Puras y sin dependencias: no calculan el calendario laboral (eso lo dice `preview`).
 */

export const BOGOTA_TIME_ZONE = 'America/Bogota';

/** Un momento civil de Bogotá. */
export interface CivilDateTime {
  /** `'YYYY-MM-DD'` */
  date: string;
  /** `'HH:mm'` (24 h) */
  time: string;
}

const instantFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BOGOTA_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Día de la semana, día y mes en español, para un día civil (se formatea en UTC: no se mueve). */
const civilDayFormatter = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'UTC',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

const civilDayMonthFormatter = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'short',
});

/** Instante (ISO o `Date`) → fecha y hora civiles en Bogotá. */
export function toBogotaCivil(instant: Date | string): CivilDateTime {
  const date = typeof instant === 'string' ? new Date(instant) : instant;
  const parts: Record<string, string> = {};
  for (const part of instantFormatter.formatToParts(date)) parts[part.type] = part.value;
  // Algún motor antiguo devuelve «24» para la medianoche aun con `h23`.
  const hour = parts.hour === '24' ? '00' : parts.hour;
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${hour}:${parts.minute}` };
}

/** «Ahora» civil en Bogotá. */
export function bogotaNow(now: Date = new Date()): CivilDateTime {
  return toBogotaCivil(now);
}

/** Hoy en Bogotá, `'YYYY-MM-DD'`. */
export function bogotaToday(now: Date = new Date()): string {
  return toBogotaCivil(now).date;
}

function civilToUtcNoon(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function utcToCivil(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Suma (o resta) días a un día civil. */
export function addCivilDays(date: string, days: number): string {
  const base = civilToUtcNoon(date);
  base.setUTCDate(base.getUTCDate() + days);
  return utcToCivil(base);
}

/** Día de la semana de un día civil: 0 = domingo … 6 = sábado (la convención del contrato). */
export function civilWeekday(date: string): number {
  return civilToUtcNoon(date).getUTCDay();
}

function clean(value: string): string {
  // Algunos motores abrevian con punto («mié.», «oct.»); la maqueta va sin él.
  return value.replace(/\.$/, '');
}

/** `'2026-10-21'` → «mié 21 oct» (con año si no es el de `today`). */
export function formatCivilDay(date: string, today?: string): string {
  const parts: Record<string, string> = {};
  for (const part of civilDayFormatter.formatToParts(civilToUtcNoon(date))) {
    parts[part.type] = clean(part.value);
  }
  const base = `${parts.weekday} ${parts.day} ${parts.month}`;
  return today && today.slice(0, 4) !== date.slice(0, 4) ? `${base} ${date.slice(0, 4)}` : base;
}

/** `'2026-10-21'` → «21 oct». */
export function formatCivilDayMonth(date: string): string {
  const parts: Record<string, string> = {};
  for (const part of civilDayMonthFormatter.formatToParts(civilToUtcNoon(date))) {
    parts[part.type] = clean(part.value);
  }
  return `${parts.day} ${parts.month}`;
}

/** «hoy» · «mañana» · «mié 21 oct». */
export function formatRelativeDay(date: string, today: string): string {
  if (date === today) return 'hoy';
  if (date === addCivilDays(today, 1)) return 'mañana';
  return formatCivilDay(date, today);
}

/** «Próximo» de la lista: «hoy, 14:00» · «mañana, 08:15» · «mié 21 oct, 09:30». */
export function formatNextFire(iso: string, now: Date = new Date()): string {
  const { date, time } = toBogotaCivil(iso);
  return `${formatRelativeDay(date, bogotaToday(now))}, ${time}`;
}

/** Día de la vista previa: «hoy, lun 19 oct» · «mañana, mar 20 oct» · «mié 21 oct». */
export function formatPreviewDay(date: string, today: string): string {
  const day = formatCivilDay(date, today);
  if (date === today) return `hoy, ${day}`;
  if (date === addCivilDays(today, 1)) return `mañana, ${day}`;
  return day;
}

/** Un par civil (fecha+hora) ya llegó: es igual o anterior al minuto actual de Bogotá. */
export function isCivilPast(date: string, time: string, now: Date = new Date()): boolean {
  const current = bogotaNow(now);
  return `${date}T${time}` <= `${current.date}T${current.time}`;
}
