import { api } from '@/core/api/fetch-client';

import type {
  CreateReminderDto,
  PreviewReminderDto,
  ReminderPreviewDto,
  ReminderResponseDto,
  ReminderTaskOptionDto,
  UpdateReminderDto,
} from '../types/reminder.types';

/**
 * Servicio del feature **Recordatorios** (HU-0202, §3.74). Todo opera sobre los recordatorios de
 * quien llama: no hay ruta para ver los de otra persona. Devuelve `T` directo (el fetch-client ya
 * desenvuelve `{ success, data }`). Solo lo usan los hooks de `../hooks/use-reminders.ts`.
 */

export interface ReminderTaskOptionsParams {
  /** Texto literal, sin regex; ≤ 100. */
  search?: string;
  /** 1..50; por defecto 20 en el servidor. */
  limit?: number;
}

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export const remindersService = {
  /** A-2 · Los míos; con `taskId`, solo los de esa tarea. Ordenados por el servidor. */
  list: (taskId?: string) =>
    api.get<ReminderResponseDto[]>(`/reminders${query({ taskId })}`),

  /** A-3 · 404 `REMINDER_NOT_FOUND` si no existe o no es mío. */
  getById: (id: string) => api.get<ReminderResponseDto>(`/reminders/${id}`),

  /** A-4 · 201. */
  create: (dto: CreateReminderDto) => api.post<ReminderResponseDto>('/reminders', dto),

  /** A-5 · Solo los campos que cambian; `schedule` se reemplaza entero. */
  update: (id: string, dto: UpdateReminderDto) =>
    api.patch<ReminderResponseDto>(`/reminders/${id}`, dto),

  /** A-6 · Idempotentes; 409 `REMINDER_FINISHED` si está cumplido. */
  pause: (id: string) => api.post<ReminderResponseDto>(`/reminders/${id}/pause`),
  resume: (id: string) => api.post<ReminderResponseDto>(`/reminders/${id}/resume`),

  /** A-7 */
  remove: (id: string) => api.delete<{ id: string }>(`/reminders/${id}`),

  /** A-8 · No escribe nada. Usa el calendario de quien llama. */
  preview: (dto: PreviewReminderDto) =>
    api.post<ReminderPreviewDto>('/reminders/preview', dto),

  /** A-9 · Tareas que puedo asociar (las que veo en el tablero). No es `/search`. */
  taskOptions: (params: ReminderTaskOptionsParams = {}) =>
    api.get<ReminderTaskOptionDto[]>(
      `/reminders/task-options${query({ search: params.search?.trim(), limit: params.limit })}`,
    ),
};
