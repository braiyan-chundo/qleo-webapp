import { api } from '@/core/api/fetch-client';

/** DTO de respuesta del backend para una columna de estado (QL-06, §3.6). */
/** Clave de la paleta de color de una columna (o `null` = derivar por índice). */
export type ColumnColor =
  | 'blue'
  | 'orange'
  | 'green'
  | 'purple'
  | 'red'
  | 'pink'
  | 'gray';

export interface Column {
  id: string;
  projectId: string;
  name: string;
  order: number;
  isDefault: boolean;
  /** Clave de paleta para el punto de color, o `null` (se deriva por índice). */
  color: ColumnColor | null;
  createdAt: string;
}

/** Body para crear una columna (§3.6). El backend fija el `order`. */
export interface CreateColumnPayload {
  name: string;
  isDefault?: boolean;
}

/** Body para renombrar / marcar como default una columna (§3.6). */
export interface UpdateColumnPayload {
  name?: string;
  isDefault?: boolean;
}

export const columnsService = {
  list: (projectId: string) => {
    return api.get<Column[]>(`/projects/${projectId}/columns`);
  },

  create: (projectId: string, data: CreateColumnPayload) => {
    return api.post<Column>(`/projects/${projectId}/columns`, data);
  },

  update: (id: string, data: UpdateColumnPayload) => {
    return api.patch<Column>(`/columns/${id}`, data);
  },

  reorder: (projectId: string, orderedIds: string[]) => {
    return api.patch<Column[]>(`/projects/${projectId}/columns/reorder`, {
      orderedIds,
    });
  },

  remove: (id: string) => {
    return api.delete<Column>(`/columns/${id}`);
  },
};
