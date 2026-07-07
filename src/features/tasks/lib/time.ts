/**
 * Utilidades de formateo del cronómetro (QL-17, RF-2.4). El backend entrega segundos; aquí
 * los convertimos a texto legible en español ("1 h 23 m", "45 s") y a `HH:MM:SS` para el
 * contador en vivo.
 */

/** Segundos → "1 h 23 m 04 s" (compacto en español). `0` → "0 s". Redondea a entero. */
export function formatDuration(totalSeconds: number): string {
  const secs = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  const seconds = secs % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} h`);
  if (minutes > 0 || hours > 0) parts.push(`${minutes} m`);
  parts.push(`${seconds} s`);
  return parts.join(' ');
}

/** Segundos → "HH:MM:SS" con relleno de ceros, para el contador en vivo. */
export function formatClock(totalSeconds: number): string {
  const secs = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  const seconds = secs % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Segundos transcurridos desde un instante ISO hasta ahora (>= 0). Sirve para arrancar el
 * contador vivo desde `runningSince` (§3.13). Devuelve 0 si el ISO es inválido.
 */
export function secondsSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  const start = new Date(iso).getTime();
  if (Number.isNaN(start)) return 0;
  return Math.max(0, Math.floor((Date.now() - start) / 1000));
}

/** ISO → fecha y hora legibles en español (ej. "2 jul 2026, 14:30"). Vacío si inválida. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
