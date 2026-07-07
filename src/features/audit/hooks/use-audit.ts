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
};

/** Listado paginado del historial de cambios, filtrable por tipo de entidad. */
export function useAuditLog(params: AuditListParams) {
  return useQuery({
    queryKey: auditKeys.list(params),
    queryFn: () => auditService.list(params),
  });
}
