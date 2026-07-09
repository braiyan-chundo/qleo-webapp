/**
 * Helpers de formato de la analítica (QL-66). El backend devuelve las duraciones en
 * **milisegundos**; aquí se humanizan (máx. 2 unidades) y se formatean las semanas del
 * throughput a una etiqueta corta.
 */

/**
 * Formatea una duración en ms a un texto legible con hasta 2 unidades:
 * `2d 4h`, `3h 20m`, `45m`, `<1 min`. Devuelve `—` para valores no positivos/ inválidos.
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—';

  const totalMinutes = Math.round(ms / 60_000);
  if (totalMinutes < 1) return '<1 min';

  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${minutes}m`;
}

/**
 * Formatea el `weekStart` (`'YYYY-MM-DD'`, lunes UTC) a una etiqueta corta tipo `07 jul`.
 * Se interpreta en UTC para no desplazar el día por zona horaria.
 */
export function formatWeekLabel(weekStart: string): string {
  const date = new Date(`${weekStart}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return weekStart;
  return date.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  });
}
