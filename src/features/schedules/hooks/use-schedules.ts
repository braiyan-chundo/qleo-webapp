import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  schedulesService,
  type CreateScheduleDto,
  type UpdateScheduleDto,
} from '../services/schedules.service';

/**
 * Hooks de datos del feature Mallas horarias (QL-160, §3.48). Todo dato del servidor pasa por
 * aquí (TanStack Query); los componentes usan estos hooks y nunca llaman al service.
 *
 * QL-162 solo **lee** la malla propia del MEMBER (`useUserSchedule`) para pintar el calendario.
 * El resto (versiones + mutaciones) queda listo para el editor de mallas del ADMIN (QL-163).
 */

/** Claves de query del feature. Centralizadas para invalidación consistente. */
export const scheduleKeys = {
  all: ['schedules'] as const,
  user: (userId: string) => [...scheduleKeys.all, 'user', userId] as const,
  userAt: (userId: string, at: string | undefined) =>
    [...scheduleKeys.user(userId), { at: at ?? null }] as const,
  userVersions: (userId: string) =>
    [...scheduleKeys.user(userId), 'versions'] as const,
};

interface UseUserScheduleOptions {
  /** Malla vigente en esta fecha (`'YYYY-MM-DD'`); por defecto la de hoy. */
  at?: string;
  enabled?: boolean;
}

/**
 * Malla **vigente** de un usuario (§3.48). El backend devuelve `null` si no tiene malla
 * aplicable. **Permiso:** un MEMBER solo puede pedir la suya (otra → 403); el llamador de
 * QL-162 pasa siempre `user.id` del store. Las mallas cambian rara vez → `staleTime` alto
 * (se refrescan en vivo por el bus realtime `schedule`).
 */
export function useUserSchedule(
  userId: string | undefined,
  { at, enabled = true }: UseUserScheduleOptions = {},
) {
  return useQuery({
    queryKey: scheduleKeys.userAt(userId ?? '', at),
    queryFn: () => schedulesService.getUserSchedule(userId as string, at),
    enabled: enabled && !!userId,
    staleTime: 30 * 60 * 1000,
  });
}

/** Historial de versiones de un usuario (solo ADMIN, §3.48). QL-163. */
export function useUserScheduleVersions(
  userId: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: scheduleKeys.userVersions(userId ?? ''),
    queryFn: () => schedulesService.getUserVersions(userId as string),
    enabled: enabled && !!userId,
    staleTime: 30 * 60 * 1000,
  });
}

/** Crea una versión nueva de malla (ADMIN) e invalida las mallas. QL-163. */
export function useCreateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateScheduleDto) => schedulesService.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
    },
  });
}

/** Corrige una versión de malla en sitio (ADMIN) e invalida las mallas. QL-163. */
export function useUpdateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateScheduleDto }) =>
      schedulesService.update(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
    },
  });
}

/** Borra una versión de malla (ADMIN) e invalida las mallas. QL-163. */
export function useDeleteSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => schedulesService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
    },
  });
}
