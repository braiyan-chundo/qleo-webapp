import { api } from '@/core/api/fetch-client';

/** DTO de respuesta del backend para una etapa (QL-05, §3.5). */
export interface Stage {
  id: string;
  projectId: string;
  name: string;
  order: number;
  createdAt: string;
}

/** Body para crear una etapa (§3.5). El backend fija el `order`. */
export interface CreateStagePayload {
  name: string;
}

/** Body para renombrar/actualizar una etapa (§3.5). */
export interface UpdateStagePayload {
  name?: string;
}

export const stagesService = {
  list: (projectId: string) => {
    return api.get<Stage[]>(`/projects/${projectId}/stages`);
  },

  create: (projectId: string, data: CreateStagePayload) => {
    return api.post<Stage>(`/projects/${projectId}/stages`, data);
  },

  update: (id: string, data: UpdateStagePayload) => {
    return api.patch<Stage>(`/stages/${id}`, data);
  },

  reorder: (projectId: string, orderedIds: string[]) => {
    return api.patch<Stage[]>(`/projects/${projectId}/stages/reorder`, {
      orderedIds,
    });
  },

  remove: (id: string) => {
    return api.delete<Stage>(`/stages/${id}`);
  },
};
