import type { UserRole } from '@/store/auth.store';

/**
 * Acciones registradas por la auditoría (§3.3).
 *
 * (QL-201, §3.73 §7) `DUPLICATE` se registra sobre la tarea **ORIGINAL** —es la entidad sobre la
 * que se actuó, "de aquí salió una copia"— y trae en `newValues` el id de la copia y el censo de
 * lo copiado. La copia recibe además su propio `CREATE`: su existencia empieza de verdad en ese
 * instante, y ese es el primer renglón legítimo de su historial. Lo que **no** se hace es clonar
 * los logs de la original a nombre de la copia.
 */
export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'ASSIGN'
  | 'COMPLETE'
  | 'REOPEN'
  | 'DUPLICATE';

/** Actor poblado en cada log de auditoría. */
export interface AuditActor {
  name: string;
  email: string;
  /** (QL-195) Rol de plataforma del actor en el momento de leerlo: puede ser `MANAGER`. */
  role: UserRole;
}

/**
 * Origen de la mutación (QL-188, §3.64). `'AI'` cuando la ejecutó el asistente tras confirmación
 * (con el `actorId` del usuario real); `'USER'` en el resto. Ausente en logs antiguos → trátalo
 * como `'USER'`. El detalle de tarea pinta "· vía asistente" cuando es `'AI'`.
 */
export type AuditOrigin = 'USER' | 'AI';

/** Entrada del historial de cambios (§3.3, DTO `AuditLog`). */
export interface AuditLog {
  _id: string;
  actorId: AuditActor;
  entityType: string;
  entityId?: string;
  action: AuditAction;
  oldValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
  createdAt: string;
  /** (QL-188) Origen de la acción; `'AI'` = ejecutada por el asistente. Default `'USER'`. */
  origin?: AuditOrigin;
}
