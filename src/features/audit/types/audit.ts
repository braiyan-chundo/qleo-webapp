/** Acciones registradas por la auditoría (§3.3). */
export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'ASSIGN'
  | 'COMPLETE'
  | 'REOPEN';

/** Actor poblado en cada log de auditoría. */
export interface AuditActor {
  name: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
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
