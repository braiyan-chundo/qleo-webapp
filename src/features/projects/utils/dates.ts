/** Utilidades de fecha para el feature Proyectos (sin dependencias externas). */

/** ISO (o cualquier fecha parseable) → `yyyy-mm-dd` para un <input type="date">. */
export function isoToDateInput(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

/** `yyyy-mm-dd` de un input date → ISO 8601 (medianoche UTC), o `undefined` si vacío. */
export function dateInputToIso(value?: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

/** `Date` local → valor de `<input type="date">` (`yyyy-mm-dd`), o `''` si no hay fecha. */
export function dateToDateInput(date: Date | undefined): string {
  if (!date || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Valor de `<input type="date">` (`yyyy-mm-dd`) → `Date` local (mediodía), o `undefined`. */
export function dateInputToDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day, 12, 0, 0);
}

/** ISO → fecha legible según el locale del navegador (ej. "2 jul 2026"). */
export function formatDate(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
