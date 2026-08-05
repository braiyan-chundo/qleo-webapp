import { civilDayToDate, dateToCivilDay } from '@/shared/lib/civil-date';

/**
 * Conversión de fechas de festivo entre el `'YYYY-MM-DD'` que espera el backend y el
 * `Date` que usa el `DatePicker`, compartida por el alta y la edición de festivos (QL-163).
 *
 * La conversión en sí vive en `@/shared/lib/civil-date` (día civil sin hora ni zona), que es
 * también la que usa la fecha de nacimiento (QL-193): **una sola implementación** del ida y
 * vuelta, para que la trampa de la zona horaria (`toISOString()` restando un día en UTC-5) esté
 * resuelta en un único sitio. Aquí solo quedan los alias del feature y su formato propio.
 */

/** `'YYYY-MM-DD'` → `Date` local (mediodía) para el DatePicker, o `undefined` si vacío. */
export function isoDayToDate(value: string): Date | undefined {
  return civilDayToDate(value);
}

/** `Date` local → `'YYYY-MM-DD'` (lo que espera el backend de festivos), o `''` si no hay. */
export function dateToIsoDay(date: Date | undefined): string {
  return dateToCivilDay(date);
}

/** Formatea un `'YYYY-MM-DD'` a fecha legible en español (ej. "6 jul 2026"). */
export function formatHolidayDate(isoDay: string): string {
  const date = civilDayToDate(isoDay);
  if (!date) return isoDay;
  return date.toLocaleDateString('es', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
