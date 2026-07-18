/**
 * Tipos del bus de tiempo real (QL-133, §3.37). Espejo del contrato del namespace `/realtime`.
 *
 * Es un **bus de invalidación, no de datos**: el servidor manda metadatos (qué cambió) y cada
 * cliente re-pide por HTTP, pasando por los guards de siempre. Por eso aquí no hay DTOs de
 * dominio: solo ids y discriminantes.
 *
 * Los payloads del socket son **planos**: NO llevan el envoltorio HTTP `{ success, data }`.
 */

/** Entidades que difunde el servidor. */
export const REALTIME_ENTITIES = [
  'project',
  'column',
  'task',
  'comment',
  'checklist',
  'attachment',
  'wall',
  'notification',
  'user-avatar',
  // Lote Y — Turnos y mallas (§3.46/§3.47/§3.48). Se emiten a la sala `wall` (todos los
  // autenticados) porque afectan al calendario de todos: catálogo global de turnos, festivos
  // y la malla de cada usuario.
  'shift', // QL-158 — cambió el catálogo global de turnos.
  'holiday', // QL-159 — cambió un festivo del calendario laboral.
  'schedule', // QL-160 — cambió una malla horaria de un usuario.
] as const;

export type RealtimeEntity = (typeof REALTIME_ENTITIES)[number];

/**
 * Acción que originó el evento. **Es informativa**: el mapa de invalidación NO ramifica por
 * ella. Ojo (§3.37): los sub-recursos POST (`/tasks/:id/complete`, `/wall/messages/:id/pin`)
 * llegan como `'created'` por el mapeo método→acción de la auditoría, y no significa que se
 * haya creado nada.
 */
export type RealtimeAction = 'created' | 'updated' | 'deleted';

/** Payload de `realtime:event` (servidor → cliente). */
export interface RealtimeEvent {
  entity: RealtimeEntity;
  action: RealtimeAction;
  /** `null` en `wall`, `notification` y `user-avatar`. */
  projectId: string | null;
  /** Presente en `task`/`comment`/`checklist` y adjuntos de tarea. */
  taskId: string | null;
  /**
   * Id de la entidad que cambió. ⚠️ En los `reorder` masivos es el id del **PADRE**
   * (`columns/reorder` → projectId; `checklist/reorder` → taskId): no cambió *una* entidad,
   * cambió la colección entera. No lo uses como "la entidad que cambió" sin mirar `entity`.
   */
  id: string;
  /** Quién lo hizo. `'system'` (centinela) si lo emitió un cron: no lo resuelvas contra `/users`. */
  actorId: string;
  /** ISO8601. */
  at: string;
}

/**
 * Valida un payload llegado por el socket antes de tratarlo como `RealtimeEvent`. Viene de la
 * red: se comprueba, no se castea a ciegas. Solo se exige lo que el mapa de invalidación
 * consume (`entity` conocida + `id`); el resto del payload se lee de forma defensiva.
 */
export function isRealtimeEvent(value: unknown): value is RealtimeEvent {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.entity === 'string' &&
    (REALTIME_ENTITIES as readonly string[]).includes(candidate.entity) &&
    typeof candidate.id === 'string'
  );
}
