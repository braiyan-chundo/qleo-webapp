import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { remindersService } from '../services/reminders.service';
import type {
  CreateReminderDto,
  PreviewReminderDto,
  UpdateReminderDto,
} from '../types/reminder.types';

/**
 * Hooks de datos del feature **Recordatorios** (HU-0202, §3.74). Todo dato del servidor pasa por
 * aquí.
 *
 * **Sin sondeo** (C.1.3): el bus `/realtime` emite `reminder` a la sala de la dueña al crear,
 * editar, pausar, reanudar, borrar y en cada recordatorio que procesa el barrido; y `task` cuando
 * una tarea se cierra o reabre (lo que cambia `blockedReason`). Los dos invalidan
 * `reminderKeys.all` (ver `use-realtime-invalidation.ts`). Toda mutación propia también.
 */
export const reminderKeys = {
  all: ['reminders'] as const,
  lists: () => [...reminderKeys.all, 'list'] as const,
  /** Sin `taskId` = todos los míos; con `taskId` = los míos de esa tarea. */
  list: (taskId?: string) => [...reminderKeys.lists(), taskId ?? 'all'] as const,
  detail: (id: string) => [...reminderKeys.all, 'detail', id] as const,
  preview: (body: PreviewReminderDto) => [...reminderKeys.all, 'preview', body] as const,
  taskOptions: (search: string) => [...reminderKeys.all, 'task-options', search] as const,
};

/** Mis recordatorios (≤ 100, sin paginar). Con `taskId`, solo los de esa tarea. */
export function useReminders(taskId?: string, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: reminderKeys.list(taskId),
    queryFn: () => remindersService.list(taskId),
    enabled,
  });
}

/**
 * Vista previa «Así sonará» (`POST /reminders/preview`, no escribe). `body: null` mientras la
 * programación esté incompleta. Conserva el resultado anterior mientras llega el nuevo para que
 * el bloque no parpadee al escribir; sin reintentos: si falla, el formulario sigue sin ella.
 */
export function useReminderPreview(body: PreviewReminderDto | null) {
  return useQuery({
    queryKey: body ? reminderKeys.preview(body) : [...reminderKeys.all, 'preview', 'none'],
    queryFn: () => remindersService.preview(body as PreviewReminderDto),
    enabled: body !== null,
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 60 * 1000,
  });
}

/** Selector de tarea (`GET /reminders/task-options`): lo que la persona ve, buscable por título. */
export function useReminderTaskOptions(search: string, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: reminderKeys.taskOptions(search),
    queryFn: () => remindersService.taskOptions({ search, limit: 20 }),
    enabled,
    staleTime: 30 * 1000,
  });
}

function useInvalidateReminders() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: reminderKeys.all });
}

export function useCreateReminder() {
  const invalidate = useInvalidateReminders();
  return useMutation({
    mutationFn: (dto: CreateReminderDto) => remindersService.create(dto),
    onSettled: invalidate,
  });
}

/**
 * Edita. Se invalida también al fallar: un 409 `REMINDER_CONFLICT` pide releer y reintentar, y un
 * 404 `REMINDER_NOT_FOUND` significa que ya no está.
 */
export function useUpdateReminder() {
  const invalidate = useInvalidateReminders();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateReminderDto }) =>
      remindersService.update(id, dto),
    onSettled: invalidate,
  });
}

export type ReminderToggleAction = 'pause' | 'resume';

/** Pausar o reanudar. La pantalla pinta `variables.action` mientras va y vuelve atrás si falla. */
export function useToggleReminder() {
  const invalidate = useInvalidateReminders();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: ReminderToggleAction }) =>
      action === 'pause' ? remindersService.pause(id) : remindersService.resume(id),
    onSettled: invalidate,
  });
}

export function useDeleteReminder() {
  const invalidate = useInvalidateReminders();
  return useMutation({
    mutationFn: (id: string) => remindersService.remove(id),
    onSettled: invalidate,
  });
}
