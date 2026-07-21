/**
 * Utilidades de fecha límite (QL-09, RF-2.1). Desde **QL-166** el deadline lleva **hora**: el
 * editor combina fecha + hora en zona **local** y serializa a ISO8601 completo (el backend ya
 * preserva el datetime). El "vencida" (`isOverdue`) pasa a comparar el **timestamp completo**
 * (`Date.now() > dueDate`), no solo el día. `isDueToday` sigue siendo por día. El chequeo de día
 * no laborable (RF-2.2 = QL-10) sigue recibiendo solo la parte fecha (`YYYY-MM-DD`).
 */

/** Hora por defecto al fijar una fecha sin hora: fin de jornada (calendario laboral 08:00–18:00). */
export const DEFAULT_DEADLINE_TIME = '18:00';

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
 * ISO → valor de `<input type="time">` (`HH:mm`) en hora **local**. Cadena vacía si no hay
 * fecha. Sirve para precargar la hora real de una `dueDate` existente al editarla (QL-166).
 */
export function isoToTimeInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Valor de `<input type="date">` (`YYYY-MM-DD`) → ISO (mediodía local para evitar saltos de
 * día por zona horaria). Cadena vacía → `null` (limpiar la fecha). Para deadlines con hora usa
 * {@link dateTimeInputToIso}; este helper se conserva para fechas **sin hora** (p. ej. inicio).
 */
export function dateInputToIso(value: string): string | null {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 12, 0, 0).toISOString();
}

/** Parsea `HH:mm` a `[hora, minuto]`; valor vacío o inválido → fin de jornada (18:00). */
function parseTimeInput(value: string | null | undefined): [number, number] {
  const [hour, minute] = (value || DEFAULT_DEADLINE_TIME).split(':').map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return [18, 0];
  return [hour, minute];
}

/**
 * (QL-166) Combina fecha (`YYYY-MM-DD`) + hora (`HH:mm`) → ISO completo en zona **local** (se
 * construye con `new Date(y, m, d, h, min)` para no saltar de día por UTC). Fecha vacía → `null`
 * (limpiar). Hora vacía → **18:00** (fin de jornada), coherente con el fallback laboral.
 */
export function dateTimeInputToIso(
  dateValue: string,
  timeValue: string | null | undefined,
): string | null {
  if (!dateValue) return null;
  const [year, month, day] = dateValue.split('-').map(Number);
  if (!year || !month || !day) return null;
  const [hour, minute] = parseTimeInput(timeValue);
  return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();
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

/**
 * ISO → fecha legible en español **con hora** (ej. "15 oct 2026, 18:00"). Cadena vacía si no
 * hay fecha. (QL-166) Antes solo mostraba el día; ahora incluye la hora del deadline.
 */
export function formatDueDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * ISO → fecha legible en español **solo día** (ej. "15 oct 2026), sin hora. Para contextos de
 * escala diaria (Gantt, fecha de inicio) donde la hora no aporta y ensucia el eje.
 */
export function formatDay(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * ISO → fecha corta sin año, **con hora** (ej. "15 oct, 18:00"). Cadena vacía si no hay fecha.
 * (QL-166) Compacta para las tarjetas: conserva el día y la hora del deadline sin el año.
 */
export function formatDueDateShort(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('es', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
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
 * (QL-166) ¿La fecha límite ya pasó? Ahora es **sensible a la hora**: compara el timestamp
 * completo (`Date.now() > dueDate`), no solo el día — una tarea que vence hoy a las 18:00 no
 * está vencida hasta que pase esa hora. El llamador decide combinarla con el estado de la tarea
 * (no marcar vencida si está cerrada).
 */
export function isOverdue(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  return Date.now() > date.getTime();
}
