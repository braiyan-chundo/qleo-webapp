import { useMemo } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  absencesService,
  type AbsenceCalendarParams,
  type AbsenceListParams,
  type AbsentUser,
  type CreateAbsenceDto,
  type UpdateAbsenceDto,
  type WhoIsOutParams,
} from '../services/absences.service';
import { clampCivilRange } from '../lib/absence';

/**
 * Hooks de datos del feature **Ausencias** (QL-199, §3.71). Todo dato del servidor pasa por aquí.
 *
 * **No hay evento de tiempo real** para ausencias (§3.71 §8): tras crear/editar/borrar hay que
 * invalidar las tres familias de queries a mano, que es lo que hace `useInvalidateAbsences`. Sin
 * eso, el calendario y el aviso del formulario de tarea seguirían mostrando el estado anterior.
 */

/** Claves de query del feature. Centralizadas para invalidación consistente. */
export const absenceKeys = {
  all: ['absences'] as const,
  types: () => [...absenceKeys.all, 'types'] as const,
  lists: () => [...absenceKeys.all, 'list'] as const,
  list: (params: AbsenceListParams) => [...absenceKeys.lists(), params] as const,
  whoIsOut: () => [...absenceKeys.all, 'who-is-out'] as const,
  whoIsOutRange: (params: WhoIsOutParams) =>
    [...absenceKeys.whoIsOut(), params] as const,
  calendars: () => [...absenceKeys.all, 'calendar'] as const,
  calendar: (params: AbsenceCalendarParams) =>
    [...absenceKeys.calendars(), params] as const,
};

/**
 * Catálogo cerrado de tipos (§3.71 §5). **Es de Dirección**: un MEMBER recibe 403, así que se
 * consulta solo desde el formulario de administración (`enabled`). Estable → `staleTime` alto.
 */
export function useAbsenceTypes({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: absenceKeys.types(),
    queryFn: () => absencesService.types(),
    enabled,
    staleTime: 30 * 60 * 1000,
  });
}

/** Listado paginado de Dirección. Sin filtros trae **todas**, pasadas y futuras. */
export function useAbsencesList(
  params: AbsenceListParams,
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: absenceKeys.list(params),
    queryFn: () => absencesService.list(params),
    enabled,
  });
}

/**
 * Quién no está en el rango, **agrupado por persona** (§3.71 §2). Cualquier autenticado.
 *
 * El rango se **acota a 366 días** antes de salir: el backend responde 400
 * `ABSENCE_RANGE_TOO_LONG` por encima de eso, y una tarea con un dedazo en el año de la fecha de
 * fin no debe llevarse por delante el aviso entero. Sin fechas, el backend responde por **hoy**,
 * que es un aviso perfectamente útil mientras no se han elegido.
 */
export function useWhoIsOut(
  params: WhoIsOutParams = {},
  { enabled = true }: { enabled?: boolean } = {},
) {
  const safeParams = useMemo(
    () => clampCivilRange(params.from, params.to),
    [params.from, params.to],
  );

  return useQuery({
    queryKey: absenceKeys.whoIsOutRange(safeParams),
    queryFn: () => absencesService.whoIsOut(safeParams),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Índice `userId → persona ausente`, que es la forma en que lo consume un selector: una sola
 * petición por rango y una búsqueda O(1) por candidato, en vez de una petición por persona.
 */
export function useAbsentByUser(absent: AbsentUser[] | undefined): Map<string, AbsentUser> {
  return useMemo(
    () => new Map((absent ?? []).map((entry) => [entry.userId, entry])),
    [absent],
  );
}

/**
 * Ausencias de **un año** para el calendario (§3.71 §3). Cualquier autenticado.
 *
 * Se consulta por `year` y no por el rango exacto de la grilla, igual que festivos y cumpleaños
 * (QL-193): un año siempre cabe en el tope de 366 días, y así la caché se comparte entre meses en
 * vez de invalidarse en cada navegación.
 */
export function useAbsenceCalendar(params: AbsenceCalendarParams = {}) {
  return useQuery({
    queryKey: absenceKeys.calendar(params),
    queryFn: () => absencesService.calendar(params),
    staleTime: 10 * 60 * 1000,
  });
}

/** Ausencias de **varios años** en paralelo, unidas en una lista (la grilla puede cruzar el año). */
export function useAbsenceCalendarForYears(years: number[]) {
  const results = useQueries({
    queries: years.map((year) => ({
      queryKey: absenceKeys.calendar({ year }),
      queryFn: () => absencesService.calendar({ year }),
      staleTime: 10 * 60 * 1000,
    })),
  });

  // Mismo patrón que `useBirthdaysForYears` (QL-193): la lista se recompone en cada render y el
  // consumidor la memoiza donde la indexa.
  return {
    absences: results.flatMap((r) => r.data ?? []),
    isLoading: results.some((r) => r.isLoading),
    isError: results.some((r) => r.isError),
  };
}

/**
 * Invalida las tres familias tras una mutación. Es obligatorio hacerlo a mano: el módulo **no
 * emite `realtime:event`**, así que nadie más va a refrescar el calendario ni el aviso.
 */
function useInvalidateAbsences() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: absenceKeys.all });
  };
}

/** Crea una ausencia (Dirección). 409 `ABSENCE_OVERLAP` si ya hay una del **mismo tipo**. */
export function useCreateAbsence() {
  const invalidate = useInvalidateAbsences();

  return useMutation({
    mutationFn: (dto: CreateAbsenceDto) => absencesService.create(dto),
    onSuccess: invalidate,
  });
}

/** Edita una ausencia (Dirección). `userId` no es editable: para cambiar de persona, borrar y crear. */
export function useUpdateAbsence() {
  const invalidate = useInvalidateAbsences();

  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateAbsenceDto }) =>
      absencesService.update(id, dto),
    onSuccess: invalidate,
  });
}

/** Borra una ausencia (Dirección). */
export function useDeleteAbsence() {
  const invalidate = useInvalidateAbsences();

  return useMutation({
    mutationFn: (id: string) => absencesService.remove(id),
    onSuccess: invalidate,
  });
}
