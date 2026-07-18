import type { Shift } from '../services/shifts.service';

/**
 * Utilidades **puras** del feature Turnos (QL-163, §3.46). Conversión entre los minutos desde
 * la medianoche local del modelo (0..1440) y el `"HH:MM"` de un `<input type="time">`, más el
 * formateo del rango horario para pintar. Sin dependencias de React ni de red.
 */

/** `480` → `"08:00"`. Minutos desde la medianoche a `HH:MM` (24h). */
export function minutesToHm(minute: number): string {
  const clamped = Math.max(0, Math.min(1440, Math.round(minute)));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * `"08:00"` → `480`. `HH:MM` (lo que emite `<input type="time">`) a minutos desde la medianoche,
 * o `null` si el formato no es válido. `"24:00"` se admite como 1440 (fin de día).
 */
export function hmToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 24 || minutes < 0 || minutes > 59) return null;
  const total = hours * 60 + minutes;
  return total > 1440 ? null : total;
}

/** `"08:00 – 12:00"` a partir de un turno del catálogo. */
export function formatShiftHours(shift: Pick<Shift, 'startMinute' | 'endMinute'>): string {
  return `${minutesToHm(shift.startMinute)} – ${minutesToHm(shift.endMinute)}`;
}
