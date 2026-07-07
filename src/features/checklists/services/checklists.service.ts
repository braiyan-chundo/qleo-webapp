import { api } from '@/core/api/fetch-client';

/** DTO de respuesta del backend para un ítem de checklist (QL-11, §3.8). */
export interface ChecklistItem {
  id: string;
  taskId: string;
  text: string;
  done: boolean;
  order: number;
  createdAt: string;
}

/** Body para crear un ítem (§3.8). El backend fija el `order`. */
export interface CreateChecklistItemPayload {
  text: string;
}

/** Body para editar el texto de un ítem (§3.8). */
export interface UpdateChecklistItemPayload {
  text?: string;
}

/** Body opcional del toggle. Si se omite `done`, el backend invierte el valor actual (§3.8). */
export interface ToggleChecklistItemPayload {
  done?: boolean;
}

/** Body para reordenar en bloque: TODOS los ids en el nuevo orden (§3.8). */
export interface ReorderChecklistPayload {
  orderedIds: string[];
}

export const checklistsService = {
  list: (taskId: string) => {
    return api.get<ChecklistItem[]>(`/tasks/${taskId}/checklist`);
  },

  create: (taskId: string, data: CreateChecklistItemPayload) => {
    return api.post<ChecklistItem>(`/tasks/${taskId}/checklist`, data);
  },

  updateText: (id: string, data: UpdateChecklistItemPayload) => {
    return api.patch<ChecklistItem>(`/checklist-items/${id}`, data);
  },

  toggle: (id: string, data?: ToggleChecklistItemPayload) => {
    return api.patch<ChecklistItem>(`/checklist-items/${id}/toggle`, data ?? {});
  },

  reorder: (taskId: string, data: ReorderChecklistPayload) => {
    return api.patch<ChecklistItem[]>(`/tasks/${taskId}/checklist/reorder`, data);
  },

  remove: (id: string) => {
    return api.delete<ChecklistItem>(`/checklist-items/${id}`);
  },
};
