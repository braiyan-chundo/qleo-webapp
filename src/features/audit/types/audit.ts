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
}
