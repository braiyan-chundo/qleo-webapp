import { useQuery } from '@tanstack/react-query';

import { auditService, type AuditListParams } from '../services/audit.service';

/**
 * Hooks de datos del feature Auditoría (§3.3). Alimenta la pantalla "Historial de
 * cambios" (`/audit`, solo ADMIN). Toda mutación del sistema se registra
 * automáticamente en el backend, así que esta pantalla refleja la actividad completa.
 */

/** Claves de query del feature. Centralizadas para invalidación consistente. */
export const auditKeys = {
  all: ['audit'] as const,
  lists: () => [...auditKeys.all, 'list'] as const,
  list: (params: AuditListParams) => [...auditKeys.lists(), params] as const,
  /** (QL-144) Historial de una entidad concreta (ej. `TASK` + su id). */
  entity: (entityType: string, entityId: string) =>
    [...auditKeys.all, 'entity', entityType, entityId] as const,
};

/** Listado paginado del historial de cambios, filtrable por tipo de entidad. */
export function useAuditLog(params: AuditListParams) {
  return useQuery({
    queryKey: auditKeys.list(params),
    queryFn: () => auditService.list(params),
  });
}

/**
 * (QL-144) Historial de auditoría de **una tarea** (`GET /audit/TASK/:taskId`). Alimenta la
 * sección "Historial de cambios" del detalle de tarea (solo ADMIN). Devuelve la lista de logs
 * (actor, acción, fecha) en orden descendente. `enabled` solo cuando hay `taskId`.
 */
export function useTaskAuditLog(taskId: string | undefined) {
  return useQuery({
    queryKey: auditKeys.entity('TASK', taskId ?? ''),
    queryFn: () => auditService.byEntity('TASK', taskId as string),
    enabled: !!taskId,
  });
}
