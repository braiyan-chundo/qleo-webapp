/**
 * Utilidades de fecha/hora del Muro (QL-95). El feed se pinta como un chat, así que
 * necesitamos la **hora corta** de cada burbuja y **separadores de día** ("HOY", "AYER",
 * fecha) entre mensajes de días distintos. Todo local al feature; no toca datos del servidor.
 */

/** Hora corta de un mensaje para la burbuja (p. ej. "14:32"). Cadena vacía si la fecha es inválida. */
export function formatWallTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Fecha corta absoluta para el pie de las tarjetas del panel de fijados (QL-93), p. ej.
 * "12 jul" (o "12 jul 2025" si es de otro año). Cadena vacía si la fecha es inválida.
 */
export function formatWallShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  return date.toLocaleDateString('es', {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
}

/**
 * (QL-170) Ventana durante la cual el **autor** puede editar o eliminar su mensaje: **5 minutos**
 * desde `createdAt`. Es la misma constante que aplica el backend (409 `WALL_EDIT_WINDOW_EXPIRED` /
 * `WALL_DELETE_WINDOW_EXPIRED` al pasarse). Se define **una sola vez** aquí; ningún componente
 * debe re-declarar el número.
 */
export const WALL_MUTATION_WINDOW_MS = 5 * 60 * 1000;

/** Texto único del porqué, para el tooltip/ayuda del menú cuando la ventana ya cerró. */
export const WALL_MUTATION_WINDOW_HINT = 'Solo dentro de los primeros 5 minutos';

/**
 * ¿El mensaje sigue dentro de la ventana de 5 min para editarlo/eliminarlo (QL-170)? `now` es
 * parámetro para poder reevaluarlo con el reloj compartido (`useMinuteTick`) sin depender de
 * cuándo se montó el componente. Una fecha inválida se trata como **fuera** de ventana: mejor
 * ocultar una acción que ofrecer una que el backend va a rechazar.
 */
export function isWithinWallMutationWindow(createdAt: string, now: number = Date.now()): boolean {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return false;
  return now - created <= WALL_MUTATION_WINDOW_MS;
}

/** Ventana (ms) para agrupar mensajes consecutivos del mismo autor (~5 min, estilo chat). */
const GROUP_WINDOW_MS = 5 * 60 * 1000;

/**
 * ¿El mensaje `next` cae dentro de la ventana de agrupación respecto al `prev` (~5 min)?
 * Se usa junto al mismo autor para pintar burbujas consecutivas "juntas" (QL-99): sin repetir
 * avatar ni nombre. Fechas inválidas o deltas negativos rompen el grupo (devuelven `false`).
 */
export function withinGroupWindow(prevIso: string, nextIso: string): boolean {
  const prev = new Date(prevIso).getTime();
  const next = new Date(nextIso).getTime();
  if (Number.isNaN(prev) || Number.isNaN(next)) return false;
  const delta = next - prev;
  return delta >= 0 && delta <= GROUP_WINDOW_MS;
}

/** ¿Dos ISO caen el **mismo día natural** (local)? Usado para agrupar el feed por día. */
export function isSameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

/**
 * Etiqueta del separador de fecha centrado (píldora) entre días del feed:
 * **HOY** / **AYER** para los dos últimos días, o la fecha larga ("12 de julio",
 * con año si es de otro año). Cadena vacía si la fecha es inválida.
 */
export function dateSeparatorLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfThat = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfThat.getTime()) / 86_400_000,
  );

  if (diffDays === 0) return 'HOY';
  if (diffDays === 1) return 'AYER';

  return date.toLocaleDateString('es', {
    day: 'numeric',
    month: 'long',
    ...(startOfThat.getFullYear() !== startOfToday.getFullYear()
      ? { year: 'numeric' }
      : {}),
  });
}
