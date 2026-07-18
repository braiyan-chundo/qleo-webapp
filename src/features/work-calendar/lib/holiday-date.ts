/**
 * Conversión de fechas de festivo entre el `'YYYY-MM-DD'` que espera el backend y el
 * `Date` que usa el `DatePicker`. Puras, sin dependencias; compartidas por el alta y la edición
 * de festivos (QL-163). El día se maneja a **mediodía local** para que el desfase horario nunca
 * mueva la fecha de día al serializar.
 */

/** `'YYYY-MM-DD'` → `Date` local (mediodía) para el DatePicker, o `undefined` si vacío. */
export function isoDayToDate(value: string): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day, 12, 0, 0);
}

/** `Date` local → `'YYYY-MM-DD'` (lo que espera el backend de festivos), o `''` si no hay. */
export function dateToIsoDay(date: Date | undefined): string {
  if (!date || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Formatea un `'YYYY-MM-DD'` a fecha legible en español (ej. "6 jul 2026"). */
export function formatHolidayDate(isoDay: string): string {
  const [year, month, day] = isoDay.split('-').map(Number);
  if (!year || !month || !day) return isoDay;
  return new Date(year, month - 1, day).toLocaleDateString('es', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
