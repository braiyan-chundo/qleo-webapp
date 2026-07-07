import { api } from '@/core/api/fetch-client';
import type { Paginated } from '@/shared/types/paginated';
import type { Project, ProjectColor } from '../types/project';

/** Campos que acepta el backend para crear/actualizar un proyecto (§3.4). */
export interface ProjectPayload {
  name: string;
  description?: string;
  code?: string;
  clientGroup?: string;
  destination?: string;
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
};
