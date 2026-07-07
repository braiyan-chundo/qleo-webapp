import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  stagesService,
  type CreateStagePayload,
  type Stage,
  type UpdateStagePayload,
} from '../services/stages.service';

/**
 * Hooks de datos del feature Etapas (QL-05). Toda la interacción con la API pasa por aquí;
 * los componentes usan estos hooks y nunca llaman al service ni manejan loading/error a mano.
 * Sigue el patrón de `features/projects/hooks/use-projects.ts`.
 */

/** Claves de query del feature. Centralizadas para invalidación consistente. */
export const stageKeys = {
  all: ['stages'] as const,
  lists: () => [...stageKeys.all, 'list'] as const,
  list: (projectId: string) => [...stageKeys.lists(), projectId] as const,
};

/** Lista de etapas de un proyecto (ordenada por `order` asc). Solo corre si hay projectId. */
export function useStages(projectId: string | undefined) {
  return useQuery({
    queryKey: stageKeys.list(projectId ?? ''),
    queryFn: () => stagesService.list(projectId as string),
    enabled: !!projectId,
  });
}

/** Crea una etapa e invalida el listado del proyecto. */
export function useCreateStage(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateStagePayload) =>
      stagesService.create(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stageKeys.list(projectId) });
    },
  });
}

/** Renombra una etapa e invalida el listado del proyecto. */
export function useRenameStage(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateStagePayload }) =>
      stagesService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stageKeys.list(projectId) });
    },
  });
}

/**
 * Reordena en bloque las etapas del proyecto. La respuesta ya viene reordenada, así que
 * sembramos la caché con ella (evita parpadeo) además de invalidar.
 */
export function useReorderStages(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderedIds: string[]) =>
      stagesService.reorder(projectId, orderedIds),
    onSuccess: (stages: Stage[]) => {
      queryClient.setQueryData(stageKeys.list(projectId), stages);
      queryClient.invalidateQueries({ queryKey: stageKeys.list(projectId) });
    },
  });
}

/** Elimina una etapa e invalida el listado del proyecto. */
export function useDeleteStage(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => stagesService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stageKeys.list(projectId) });
    },
  });
}
