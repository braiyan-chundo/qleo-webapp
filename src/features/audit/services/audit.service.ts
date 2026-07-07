import { api } from '@/core/api/fetch-client';
import type { Paginated } from '@/shared/types/paginated';
import type { AuditLog } from '../types/audit';

/** Filtros del historial de auditoría (§3.3). Todos los endpoints requieren `ADMIN`. */
export interface AuditListParams {
  page?: number;
  limit?: number;
  entityType?: string;
}

function buildQuery(params: AuditListParams): string {
  const search = new URLSearchParams();
  if (params.page != null) search.set('page', String(params.page));
  if (params.limit != null) search.set('limit', String(params.limit));
  if (params.entityType) search.set('entityType', params.entityType);
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export const auditService = {
  /** Historial de cambios paginado y filtrable por tipo de entidad. **Solo ADMIN**. */
  list: (params: AuditListParams = {}) => {
    return api.get<Paginated<AuditLog>>(`/audit${buildQuery(params)}`);
  },

  /** Todas las acciones de un actor (orden descendente por fecha). **Solo ADMIN**. */
  byActor: (actorId: string) => {
    return api.get<AuditLog[]>(`/audit/actor/${actorId}`);
  },

  /** Historial de una entidad concreta (ej. una tarea). **Solo ADMIN**. */
  byEntity: (entityType: string, entityId: string) => {
    return api.get<AuditLog[]>(`/audit/${entityType}/${entityId}`);
  },
};
