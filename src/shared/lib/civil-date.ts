/**
 * Utilidades de **día civil** (`'YYYY-MM-DD'`: una fecha del calendario, sin hora ni zona).
 * Es el formato con el que viajan los festivos (§3.12) y la fecha de nacimiento (§3.66).
 *
 * **Por qué existe este módulo:** `new Date('1990-05-12')` interpreta la cadena como
 * **UTC medianoche**, y `date.toISOString()` la vuelve a llevar a UTC. En `America/Bogota`
 * (UTC-5) ese viaje de ida y vuelta desplaza el día: el 12 se guarda/pinta como el 11. Aquí
 * nunca se pasa por UTC —ni al parsear ni al serializar—:
 *
 * - **Parseo**: se construye el `Date` con los componentes locales (`new Date(y, m-1, d)`) a
 *   **mediodía**, para que ningún cambio de horario de verano lo mueva de día.
 * - **Serialización**: se leen `getFullYear/getMonth/getDate` (locales) y se concatenan. Nunca
 *   `toISOString()`.
 *
 * Puras y sin dependencias.
 */

/** Hora del día a la que se ancla un día civil: mediodía local (a salvo de DST). */
const NOON = 12;

/**
 * `'YYYY-MM-DD'` → `Date` **local** a mediodía (el valor que consume el `DatePicker`).
 * Devuelve `undefined` si el valor está vacío o no tiene la forma esperada.
 */
export function civilDayToDate(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day, NOON, 0, 0);
}

/**
 * `Date` local → `'YYYY-MM-DD'` con los **componentes locales** del día elegido. Es lo que
 * se manda al backend; jamás `toISOString()`. Devuelve `''` si no hay fecha (el "borrar").
 */
export function dateToCivilDay(date: Date | null | undefined): string {
  if (!date || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formatea un día civil legible en español (ej. "12 may 2026") **sin** pasar por UTC: se
 * reconstruye el `Date` con componentes locales antes de formatear. Si el valor no es un día
 * civil válido se devuelve tal cual (mejor mostrar el crudo que una fecha inventada).
 */
export function formatCivilDay(value: string): string {
  const date = civilDayToDate(value);
  if (!date) return value;
  return date.toLocaleDateString('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Etiqueta de **día y mes sin año** (ej. "12 de mayo"). La usa todo lo que muestra un
 * cumpleaños a terceros (§3.66): el año nunca se enseña, para que no se deduzca la edad.
 * El año 2000 (bisiesto) es solo el andamio del formateo — permite el 29 de febrero.
 */
export function dayMonthLabel(day: number, month: number): string {
  return new Date(2000, month - 1, day).toLocaleDateString('es', {
    day: 'numeric',
    month: 'long',
  });
}
