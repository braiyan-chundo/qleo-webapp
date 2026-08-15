import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { SAFETY_NET_POLL_MS } from '@/core/query/query-client';

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

/**
 * Lista de ítems del checklist de una tarea (ordenada por `order` asc). Solo corre si hay taskId.
 * (QL-133) Los cambios de colaboradores llegan en vivo por el bus `/realtime`
 * (`entity: 'checklist'`); el poll queda de red de seguridad.
 */
export function useChecklist(taskId: string | undefined) {
  return useQuery({
    queryKey: checklistKeys.list(taskId ?? ''),
    queryFn: () => checklistsService.list(taskId as string),
    enabled: !!taskId,
    refetchInterval: SAFETY_NET_POLL_MS,
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

/**
 * (QL-201, §3.73 §10) **Desmarca todo** el checklist de una tarea.
 *
 * Existe por un detalle de la duplicación: el checklist se copia **con su estado `done`**, porque
 * el cliente pidió conservar la información. Si el uso real resulta ser "duplicar para rehacer",
 * lo que falta es un gesto de UI **después** de copiar — no desmarcar por defecto, que sería
 * perder el dato que se pidió guardar. De ahí que sea una acción explícita y no un flag del alta.
 *
 * No hay endpoint de lote, así que recorre los ítems marcados y manda un toggle **explícito**
 * (`done: false`) por cada uno: sin el `done` el backend invierte el valor actual y una carrera
 * con otro usuario podría acabar marcando lo que se quería desmarcar. Un checklist típico son
 * unos pocos ítems; las llamadas van en serie para no disparar una ráfaga contra la API.
 *
 * Permitido a CREATOR/ASSIGNEE/COLLABORATOR (los mismos que el toggle normal).
 */
export function useUncheckAllChecklist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string): Promise<number> => {
      const items = await checklistsService.list(taskId);
      const done = items.filter((item) => item.done);
      for (const item of done) {
        await checklistsService.toggle(item.id, { done: false });
      }
      return done.length;
    },
    onSuccess: (_count, taskId) => {
      queryClient.invalidateQueries({ queryKey: checklistKeys.list(taskId) });
      // El progreso del checklist viaja en la propia tarea (`checklistDone`), que se pinta en la
      // tarjeta del tablero y en el detalle: sin esto, la copia seguiría anunciando "5/5".
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
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
