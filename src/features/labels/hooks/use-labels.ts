import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { projectKeys } from '@/features/projects/hooks/use-projects';
import { taskKeys } from '@/features/tasks/hooks/use-tasks';

import {
  labelsService,
  type CreateLabelPayload,
  type LabelListParams,
  type UpdateLabelPayload,
} from '../services/labels.service';

/**
 * Hooks de datos del feature Etiquetas (QL-146, §3.38). Toda la interacción con la API pasa
 * por aquí; los componentes usan estos hooks y nunca llaman al service. Sigue el patrón de
 * `features/users/hooks/use-users.ts` (catálogo buscable no paginado).
 */

/** Claves de query del feature. Centralizadas para invalidación consistente. */
export const labelKeys = {
  all: ['labels'] as const,
  lists: () => [...labelKeys.all, 'list'] as const,
  list: (params: LabelListParams) => [...labelKeys.lists(), params] as const,
};

interface UseLabelsOptions {
  /** Controla si la query se dispara (p. ej. solo cuando el picker está visible). */
  enabled?: boolean;
  /** Incluir etiquetas archivadas (por defecto solo activas). */
  includeArchived?: boolean;
}

/**
 * Catálogo global de etiquetas para el picker (§3.38). No requiere rol de plataforma:
 * cualquier autenticado puede leer el catálogo. `search` filtra por nombre en el backend.
 */
export function useLabels(
  search: string,
  { enabled = true, includeArchived = false }: UseLabelsOptions = {},
) {
  const term = search.trim();
  const params: LabelListParams = { search: term || undefined, includeArchived };

  return useQuery({
    queryKey: labelKeys.list(params),
    queryFn: () => labelsService.list(params),
    enabled,
  });
}

/**
 * Crea (o recupera) una etiqueta del catálogo (§3.38, get-or-create). Invalida los listados
 * para que el picker refleje la etiqueta recién añadida. Es la que dispara "crear etiqueta
 * nueva desde el proyecto": el llamador toma el `id` devuelto y lo adopta en `project.labelIds`.
 */
export function useCreateLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateLabelPayload) => labelsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labelKeys.lists() });
    },
  });
}

/**
 * Invalida todo lo que una etiqueta puede pintar (QL-149). Además del catálogo, refresca
 * **proyectos y tareas** porque una etiqueta viene resuelta (`project.labels` / `task.labels`):
 * al renombrar/recolorear cambia su render y al borrar desaparece **en cascada** de sus sets
 * (`labelIds`), así que las vistas que la mostraban deben refetch (§3.38).
 */
function invalidateLabelCascade(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  queryClient.invalidateQueries({ queryKey: labelKeys.lists() });
  queryClient.invalidateQueries({ queryKey: projectKeys.all });
  queryClient.invalidateQueries({ queryKey: taskKeys.all });
}

/**
 * Cura una etiqueta del catálogo (nombre/icono/color/archivado). Solo ADMIN (§3.38). El renombre
 * puede fallar con **409 `LABEL_NAME_TAKEN`**; el llamador lo traduce a un mensaje claro.
 */
export function useUpdateLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateLabelPayload }) =>
      labelsService.update(id, data),
    onSuccess: () => invalidateLabelCascade(queryClient),
  });
}

/**
 * Borra una etiqueta del catálogo (solo ADMIN, §3.38). El backend la quita **en cascada** de
 * proyectos y tareas, por eso se invalidan también sus queries.
 */
export function useDeleteLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => labelsService.remove(id),
    onSuccess: () => invalidateLabelCascade(queryClient),
  });
}
