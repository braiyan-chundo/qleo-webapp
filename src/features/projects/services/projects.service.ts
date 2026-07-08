import { api } from '@/core/api/fetch-client';
import type { Paginated } from '@/shared/types/paginated';
import type { Project, ProjectColor, ProjectMember } from '../types/project';

/** Campos que acepta el backend para crear/actualizar un proyecto (§3.4). */
export interface ProjectPayload {
  name: string;
  description?: string;
  code?: string;
  clientGroup?: string;
  startDate?: string;
  endDate?: string;
  /** Color distintivo (QL-29). `null` limpia el color; omitido = no toca. */
  color?: ProjectColor | null;
}

/** En PATCH todos los campos son opcionales. */
export type UpdateProjectPayload = Partial<ProjectPayload>;

/** Filtros de listado de proyectos. */
export interface ProjectListParams {
  page?: number;
  limit?: number;
  search?: string;
  archived?: boolean;
}

function buildQuery(params: ProjectListParams): string {
  const search = new URLSearchParams();
  if (params.page != null) search.set('page', String(params.page));
  if (params.limit != null) search.set('limit', String(params.limit));
  if (params.search) search.set('search', params.search);
  if (params.archived != null) search.set('archived', String(params.archived));
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export const projectsService = {
  list: (params: ProjectListParams = {}) => {
    return api.get<Paginated<Project>>(`/projects${buildQuery(params)}`);
  },

  getById: (id: string) => {
    return api.get<Project>(`/projects/${id}`);
  },

  create: (data: ProjectPayload) => {
    return api.post<Project>('/projects', data);
  },

  update: (id: string, data: UpdateProjectPayload) => {
    return api.patch<Project>(`/projects/${id}`, data);
  },

  archive: (id: string) => {
    return api.delete<Project>(`/projects/${id}`);
  },

  /**
   * Membresía **real** del proyecto (§3.20, QL-51). Alimenta el picker de asignación de
   * tareas (solo miembros del proyecto). Requiere ser miembro o ADMIN; si no → 404.
   */
  listMembers: (id: string) => {
    return api.get<ProjectMember[]>(`/projects/${id}/members`);
  },

  /**
   * Añade un miembro al proyecto (§3.20). Idempotente. Solo ADMIN o creador (403 si no).
   * Devuelve el `Project` con la membresía real actualizada.
   */
  addMember: (id: string, userId: string) => {
    return api.post<Project>(`/projects/${id}/members`, { userId });
  },

  /**
   * Quita un miembro del proyecto (§3.20). Con tareas abiertas y sin `reassignTo` →
   * 409 `MEMBER_HAS_OPEN_ASSIGNMENTS`; con `reassignTo` traspasa las asignaciones abiertas
   * al destino (que debe ser miembro, o 400 `USER_NOT_PROJECT_MEMBER`). No se puede quitar
   * al creador (400). Devuelve el `Project` con la membresía real actualizada.
   */
  removeMember: (id: string, userId: string, reassignTo?: string) => {
    const qs = reassignTo ? `?reassignTo=${encodeURIComponent(reassignTo)}` : '';
    return api.delete<Project>(`/projects/${id}/members/${userId}${qs}`);
  },
};
