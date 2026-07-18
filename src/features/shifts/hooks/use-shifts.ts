import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  shiftsService,
  type CreateShiftDto,
  type UpdateShiftDto,
} from '../services/shifts.service';

/**
 * Hooks de datos del feature Turnos (QL-158, §3.46). Todo dato del servidor pasa por aquí
 * (TanStack Query); los componentes usan estos hooks y nunca llaman al service. El catálogo
 * cambia rara vez → `staleTime` alto (se refresca en vivo por el bus realtime `shift`).
 *
 * Hoy QL-162 solo **lee** (`useShifts`) para pintar el calendario; las mutaciones quedan listas
 * para el editor de turnos del ADMIN (QL-163).
 */

/** Claves de query del feature. Centralizadas para invalidación consistente. */
export const shiftKeys = {
  all: ['shifts'] as const,
  list: (includeInactive: boolean) => [...shiftKeys.all, { includeInactive }] as const,
};

/**
 * Catálogo global de turnos (§3.46). Cualquier autenticado puede leerlo. Por defecto solo
 * activos; `includeInactive` incluye los retirados (para el editor del ADMIN, QL-163).
 */
export function useShifts(includeInactive = false) {
  return useQuery({
    queryKey: shiftKeys.list(includeInactive),
    queryFn: () => shiftsService.list(includeInactive),
    staleTime: 30 * 60 * 1000,
  });
}

/** Crea un turno (ADMIN) e invalida el catálogo. 409 `SHIFT_NAME_TAKEN`. QL-163. */
export function useCreateShift() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateShiftDto) => shiftsService.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shiftKeys.all });
    },
  });
}

/** Edita un turno (ADMIN) e invalida el catálogo. QL-163. */
export function useUpdateShift() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateShiftDto }) =>
      shiftsService.update(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shiftKeys.all });
    },
  });
}

/**
 * Borra un turno (ADMIN) e invalida el catálogo. Una malla que lo referenciara lo verá
 * omitido al repoblarse (§3.48), así que conviene refrescar también las mallas (QL-163). QL-163.
 */
export function useDeleteShift() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => shiftsService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shiftKeys.all });
    },
  });
}
