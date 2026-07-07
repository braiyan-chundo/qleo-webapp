import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  columnsService,
  type Column,
  type CreateColumnPayload,
  type UpdateColumnPayload,
} from '../services/columns.service';

/**
 * Hooks de datos del feature Columnas de estado (QL-06). Toda la interacción con la API
 * pasa por aquí; los componentes usan estos hooks y nunca llaman al service ni manejan
 * loading/error a mano. Sigue el patrón de `features/projects/hooks/use-projects.ts`.
 */

/** Claves de query del feature. Centralizadas para invalidación consistente. */
export const columnKeys = {
  all: ['columns'] as const,
  lists: () => [...columnKeys.all, 'list'] as const,
  list: (projectId: string) => [...columnKeys.lists(), projectId] as const,
};

/** Lista de columnas de un proyecto (ordenada por `order` asc). Solo corre si hay projectId. */
export function useColumns(projectId: string | undefined) {
  return useQuery({
    queryKey: columnKeys.list(projectId ?? ''),
    queryFn: () => columnsService.list(projectId as string),
    enabled: !!projectId,
  });
}

/** Crea una columna e invalida el listado del proyecto. */
export function useCreateColumn(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateColumnPayload) =>
      columnsService.create(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: columnKeys.list(projectId) });
    },
  });
}

/**
 * Actualiza una columna (nombre y/o `isDefault`) e invalida el listado. Al marcar una como
 * default el backend desmarca las demás, por eso basta con invalidar y refrescar.
 */
export function useUpdateColumn(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateColumnPayload }) =>
      columnsService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: columnKeys.list(projectId) });
    },
  });
}

/**
 * Reordena en bloque las columnas del proyecto. La respuesta ya viene reordenada, así que
 * sembramos la caché con ella (evita parpadeo) además de invalidar.
 */
export function useReorderColumns(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderedIds: string[]) =>
      columnsService.reorder(projectId, orderedIds),
    onSuccess: (columns: Column[]) => {
      queryClient.setQueryData(columnKeys.list(projectId), columns);
      queryClient.invalidateQueries({ queryKey: columnKeys.list(projectId) });
    },
  });
}

/**
 * Elimina una columna e invalida el listado. Puede rechazar con `ApiError`
 * (`code === 'COLUMN_HAS_TASKS'`, 409); el componente decide el mensaje.
 */
export function useDeleteColumn(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => columnsService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: columnKeys.list(projectId) });
    },
  });
}
