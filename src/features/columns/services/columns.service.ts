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
  /** (QL-61) `true` = columna **Backlog** del proyecto (una por proyecto; nace como default). */
  isBacklog: boolean;
  /** (QL-62) `true` = columna de **inicio** (máx. una); al mover aquí se fija `Task.startedAt`. */
  isStart: boolean;
  /** (QL-62) `true` = columna de **fin** (máx. una); al mover aquí se fija `Task.finishedAt`. */
  isEnd: boolean;
  /** Clave de paleta para el punto de color, o `null` (se deriva por índice). */
  color: ColumnColor | null;
  createdAt: string;
}

/** Body para crear una columna (§3.6). El backend fija el `order`. */
export interface CreateColumnPayload {
  name: string;
  isDefault?: boolean;
  /** (QL-62) marca esta columna como inicio; el backend desmarca la anterior. */
  isStart?: boolean;
  /** (QL-62) marca esta columna como fin; el backend desmarca la anterior. */
  isEnd?: boolean;
}

/** Body para renombrar / marcar default / configurar inicio-fin una columna (§3.6, §3.22). */
export interface UpdateColumnPayload {
  name?: string;
  isDefault?: boolean;
  /** (QL-62) `true` marca inicio (desmarca la anterior); `false` la quita. Gated a ADMIN/creador. */
  isStart?: boolean;
  /** (QL-62) `true` marca fin (desmarca la anterior); `false` la quita. Gated a ADMIN/creador. */
  isEnd?: boolean;
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

  /**
   * (QL-61) "Usar plantilla básica": añade las columnas estándar que falten (`Por hacer`,
   * `En progreso`, `Hecho`) tras las existentes. Idempotente. Devuelve **todas** las columnas
   * del proyecto ya ordenadas, para refrescar la caché sin un GET extra. Solo ADMIN/creador.
   */
  applyTemplate: (projectId: string) => {
    return api.post<Column[]>(`/projects/${projectId}/columns/apply-template`);
  },

  remove: (id: string) => {
    return api.delete<Column>(`/columns/${id}`);
  },
};
