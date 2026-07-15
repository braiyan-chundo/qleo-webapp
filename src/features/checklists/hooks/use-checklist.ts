import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  checklistsService,
  type ChecklistItem,
  type CreateChecklistItemPayload,
  type ToggleChecklistItemPayload,
  type UpdateChecklistItemPayload,
} from '../services/checklists.service';

/**
 * Hooks de datos del feature Checklists granulares (QL-11). Toda la interacción con la API
 * pasa por aquí; los componentes usan estos hooks y nunca llaman al service ni manejan
 * loading/error a mano. Sigue el patrón de `features/columns/hooks/use-columns.ts`.
 */

/** Claves de query del feature. Centralizadas para invalidación consistente. */
export const checklistKeys = {
  all: ['checklist'] as const,
  lists: () => [...checklistKeys.all, 'list'] as const,
  list: (taskId: string) => [...checklistKeys.lists(), taskId] as const,
};

/** (P8) Intervalo de sondeo del checklist (MVP = polling; cambios de colaboradores en vivo). */
const CHECKLIST_POLL_MS = 15_000;

/**
 * Lista de ítems del checklist de una tarea (ordenada por `order` asc). Solo corre si hay taskId.
 * Sondea cada ~15 s y al reenfocar la ventana para ver cambios de otras sesiones (P8).
 */
export function useChecklist(taskId: string | undefined) {
  return useQuery({
    queryKey: checklistKeys.list(taskId ?? ''),
    queryFn: () => checklistsService.list(taskId as string),
    enabled: !!taskId,
    refetchInterval: CHECKLIST_POLL_MS,
    refetchOnWindowFocus: true,
  });
}

/** Añade un ítem e invalida el checklist de la tarea. Solo CREATOR/ASSIGNEE. */
export function useAddItem(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateChecklistItemPayload) =>
      checklistsService.create(taskId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: checklistKeys.list(taskId) });
    },
  });
}

/**
 * Marca/desmarca un ítem. La respuesta trae el ítem actualizado, así que sembramos la caché
 * con él (se siente instantáneo) además de invalidar. Permitido a CREATOR/ASSIGNEE/COLLABORATOR.
 */
export function useToggleItem(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: ToggleChecklistItemPayload }) =>
      checklistsService.toggle(id, data),
    onSuccess: (item: ChecklistItem) => {
      queryClient.setQueryData<ChecklistItem[]>(
        checklistKeys.list(taskId),
        (prev) => prev?.map((i) => (i.id === item.id ? item : i)),
      );
      queryClient.invalidateQueries({ queryKey: checklistKeys.list(taskId) });
    },
  });
}

/** Edita el texto de un ítem e invalida el checklist. Solo CREATOR/ASSIGNEE. */
export function useUpdateItem(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateChecklistItemPayload }) =>
      checklistsService.updateText(id, data),
    onSuccess: (item: ChecklistItem) => {
      queryClient.setQueryData<ChecklistItem[]>(
        checklistKeys.list(taskId),
        (prev) => prev?.map((i) => (i.id === item.id ? item : i)),
      );
      queryClient.invalidateQueries({ queryKey: checklistKeys.list(taskId) });
    },
  });
}

/**
 * Reordena en bloque el checklist de la tarea. La respuesta ya viene reordenada, así que
 * sembramos la caché con ella (evita parpadeo) además de invalidar. Solo CREATOR/ASSIGNEE.
 */
export function useReorderChecklist(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderedIds: string[]) =>
      checklistsService.reorder(taskId, { orderedIds }),
    onSuccess: (items: ChecklistItem[]) => {
      queryClient.setQueryData(checklistKeys.list(taskId), items);
      queryClient.invalidateQueries({ queryKey: checklistKeys.list(taskId) });
    },
  });
}

/** Elimina un ítem e invalida el checklist. Solo CREATOR/ASSIGNEE. */
export function useDeleteItem(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => checklistsService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: checklistKeys.list(taskId) });
    },
  });
}
