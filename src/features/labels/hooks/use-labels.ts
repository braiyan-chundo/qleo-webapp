import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  labelsService,
  type CreateLabelPayload,
  type LabelListParams,
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
