import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  workCalendarService,
  type CreateHolidayDto,
  type Holiday,
  type HolidaysParams,
} from '../services/work-calendar.service';

/**
 * Hooks de datos del feature Calendario laboral (QL-10, §3.12). Todo dato del servidor pasa
 * por aquí (TanStack Query); los componentes usan estos hooks y nunca llaman al service ni
 * manejan loading/error a mano. Los festivos cambian rara vez → `staleTime` alto.
 */

/** Claves de query del feature. Centralizadas para invalidación consistente. */
export const calendarKeys = {
  all: ['work-calendar'] as const,
  check: (date: string) => [...calendarKeys.all, 'check', date] as const,
  holidays: () => [...calendarKeys.all, 'holidays'] as const,
  holidayList: (params?: HolidaysParams) =>
    [...calendarKeys.holidays(), params ?? {}] as const,
};

/**
 * Evalúa una fecha (`GET /work-calendar/check`) y sugiere el siguiente día hábil. Solo corre
 * con una fecha válida (`enabled`). Usado por `DeadlineSection` para avisar (no bloquea).
 */
export function useCheckDate(dateIso: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: calendarKeys.check(dateIso),
    queryFn: () => workCalendarService.check(dateIso),
    enabled: (options?.enabled ?? true) && !!dateIso,
    staleTime: 5 * 60 * 1000,
  });
}

/** Lista de festivos (ordenada por fecha asc). Cambian rara vez → `staleTime` alto. */
export function useHolidays(params?: HolidaysParams) {
  return useQuery({
    queryKey: calendarKeys.holidayList(params),
    queryFn: () => workCalendarService.listHolidays(params),
    staleTime: 30 * 60 * 1000,
  });
}

/** Registra un festivo (ADMIN) e invalida la lista. 409 `HOLIDAY_ALREADY_EXISTS`. */
export function useCreateHoliday() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateHolidayDto) => workCalendarService.createHoliday(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: calendarKeys.holidays() });
    },
  });
}

/** Elimina un festivo (ADMIN) e invalida la lista. */
export function useDeleteHoliday() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => workCalendarService.deleteHoliday(id),
    onSuccess: (_deleted: Holiday) => {
      queryClient.invalidateQueries({ queryKey: calendarKeys.holidays() });
    },
  });
}
