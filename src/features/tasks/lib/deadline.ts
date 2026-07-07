/**
 * Utilidades de fecha límite (QL-09, RF-2.1). El "vencida" usa **solo comparación de fecha**
 * (día), sin lógica de calendario laboral (RF-2.2 = QL-10, aparte).
 */

/** ISO (`2026-07-02T14:00:00.000Z`) → valor de `<input type="date">` (`YYYY-MM-DD`). */
export function isoToDateInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Valor de `<input type="date">` (`YYYY-MM-DD`) → ISO (mediodía local para evitar saltos de
 * día por zona horaria). Cadena vacía → `null` (limpiar la fecha).
 */
export function dateInputToIso(value: string): string | null {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 12, 0, 0).toISOString();
}

/** `Date` local → valor de `<input type="date">` (`YYYY-MM-DD`), o `''` si no hay fecha. */
export function dateToDateInput(date: Date | undefined): string {
  if (!date || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Valor de `<input type="date">` (`YYYY-MM-DD`) → `Date` local (mediodía), o `undefined`. */
export function dateInputToDate(value: string): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day, 12, 0, 0);
}

/** ISO → fecha legible en español (ej. "2 jul 2026"). Cadena vacía si no hay fecha. */
export function formatDueDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** ISO → fecha corta sin año (ej. "15 oct"). Cadena vacía si no hay fecha. */
export function formatDueDateShort(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

/** Día (medianoche local) de una fecha, para comparar solo por día sin horas. */
function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** ¿La fecha límite es hoy? Comparación solo por día. */
export function isDueToday(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  return startOfDay(date) === startOfDay(new Date());
}

/**
 * ¿La fecha límite ya pasó? Comparación **solo de día** (hoy no cuenta como vencida). El
 * llamador decide combinarla con el estado de la tarea (no marcar vencida si está cerrada).
 */
export function isOverdue(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  return startOfDay(date) < startOfDay(new Date());
}
