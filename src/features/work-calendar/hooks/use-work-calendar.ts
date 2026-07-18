import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  workCalendarService,
  type CreateHolidayDto,
  type Holiday,
  type HolidaysParams,
  type UpdateCalendarConfigDto,
  type UpdateHolidayDto,
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
  config: () => [...calendarKeys.all, 'config'] as const,
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

/**
 * (QL-69) Festivos de **varios años** en paralelo, unidos en una sola lista. Se consulta por
 * `year` (no por rango `from/to`) porque el backend genera los `AUTO` on-demand justo cuando se
 * pide un año concreto; así una vista de rango multi-año tiene sus festivos automáticos.
 */
export function useHolidaysForYears(years: number[]) {
  const results = useQueries({
    queries: years.map((year) => ({
      queryKey: calendarKeys.holidayList({ year }),
      queryFn: () => workCalendarService.listHolidays({ year }),
      staleTime: 30 * 60 * 1000,
    })),
  });

  return {
    holidays: results.flatMap((r) => r.data ?? []),
    isLoading: results.some((r) => r.isLoading),
    isError: results.some((r) => r.isError),
  };
}

/** (QL-68) Config del calendario laboral (fines de semana, país, festivos automáticos). */
export function useCalendarConfig() {
  return useQuery({
    queryKey: calendarKeys.config(),
    queryFn: () => workCalendarService.getConfig(),
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * (QL-68) Actualiza la config (ADMIN). Invalida config **y** festivos: el toggle
 * `autoColombianHolidays` genera/elimina los `AUTO`, cambiando las listas.
 */
export function useUpdateCalendarConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: UpdateCalendarConfigDto) =>
      workCalendarService.updateConfig(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: calendarKeys.config() });
      queryClient.invalidateQueries({ queryKey: calendarKeys.holidays() });
    },
  });
}

/** (QL-68) Genera los festivos colombianos de un año (ADMIN) e invalida las listas. */
export function useGenerateHolidays() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (year: number) => workCalendarService.generateHolidays(year),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: calendarKeys.holidays() });
    },
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

/**
 * (QL-159, §3.47) Edita un festivo MANUAL (ADMIN) e invalida la lista. Puede fallar con 400
 * `AUTO_HOLIDAY_NOT_EDITABLE` o 409 `HOLIDAY_ALREADY_EXISTS`; el llamador (QL-163) lo traduce.
 */
export function useUpdateHoliday() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateHolidayDto }) =>
      workCalendarService.updateHoliday(id, dto),
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
