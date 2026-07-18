import { api } from '@/core/api/fetch-client';

/**
 * Servicio del feature Mallas horarias (QL-160, §3.48). Tercera pieza del epic **Turnos y
 * mallas** (Lote Y). Una **malla** (`UserSchedule`) asigna turnos por día de la semana a un
 * usuario, **con vigencia** (`validFrom`: cada cambio es una versión nueva) y **sábado
 * intermedio** (semanas alternas ancladas a una fecha de referencia). Es **global**. La
 * configura solo el ADMIN; el MEMBER solo **lee la suya**.
 *
 * Devuelve `T` directo: el fetch-client ya desenvuelve `{ success, data }` y maneja el 401.
 */

/**
 * Turno **poblado** dentro de una malla (§3.48): el backend resuelve los `shiftIds` a esta
 * forma para pintar sin N+1. Los turnos ya retirados que aún referencie una versión antigua se
 * **omiten** en la población (no rompen la respuesta).
 */
export interface ResolvedShift {
  id: string;
  name: string;
  /** Minutos desde la medianoche local (0..1440). */
  startMinute: number;
  endMinute: number;
  /** Hex `#RRGGBB` o `null`. */
  color: string | null;
}

/** Un día de la semana dentro de la malla: sus turnos (0..N, ordenados por `startMinute`). */
export interface ScheduleWeekday {
  shifts: ResolvedShift[];
}

/**
 * Malla horaria **vigente** de un usuario (§3.48). `weekdays` tiene **7** entradas, **índice
 * 0 = Domingo … 6 = Sábado** (convención `Date.getUTCDay()`). El sábado (`weekdays[6]`) puede
 * regir en semanas alternas (`saturdayAlternate` + `saturdayAnchor`).
 */
export interface UserSchedule {
  id: string;
  userId: string;
  /** `'YYYY-MM-DD'` — desde cuándo rige esta versión. */
  validFrom: string;
  /** 7 entradas (0=Dom…6=Sáb). */
  weekdays: ScheduleWeekday[];
  /** Si `true`, los turnos del sábado solo rigen semanas alternas. */
  saturdayAlternate: boolean;
  /** `'YYYY-MM-DD'` (un sábado) que fija la paridad, o `null`. */
  saturdayAnchor: string | null;
  createdAt: string; // ISO8601
}

/** Body de `POST /schedules` (solo ADMIN, §3.48). Crea una versión NUEVA. Lo consume QL-163. */
export interface CreateScheduleDto {
  userId: string;
  /** ISO8601 / `'YYYY-MM-DD'`. */
  validFrom: string;
  /** EXACTAMENTE 7 (0=Dom…6=Sáb); cada `shiftIds` 0..N ObjectId. */
  weekdays: { shiftIds: string[] }[];
  saturdayAlternate?: boolean;
  /** `'YYYY-MM-DD'` (un sábado); requerido si `saturdayAlternate` y el sábado tiene turnos. */
  saturdayAnchor?: string | null;
}

/**
 * Body de `PATCH /schedules/:id` (solo ADMIN, §3.48). Corrige EN SITIO (no crea versión).
 * `userId` NO se cambia. Todos opcionales; `weekdays` si se manda deben ser 7. Lo consume QL-163.
 */
export interface UpdateScheduleDto {
  validFrom?: string;
  weekdays?: { shiftIds: string[] }[];
  saturdayAlternate?: boolean;
  saturdayAnchor?: string | null;
}

export const schedulesService = {
  /**
   * Malla **vigente** de un usuario (la de mayor `validFrom ≤ hoy`, o la vigente en `at`).
   * Devuelve **`null`** si el usuario no tiene malla aplicable. Un ADMIN puede leer la de
   * cualquiera; un MEMBER solo la suya (si pide otra → **403**). La consumen los calendarios
   * del MEMBER (QL-162) y del ADMIN (QL-163).
   */
  getUserSchedule: (userId: string, at?: string) =>
    api.get<UserSchedule | null>(
      `/schedules/user/${userId}${at ? `?at=${at}` : ''}`,
    ),

  /** Historial de versiones de un usuario (DESC por `validFrom`). Solo ADMIN. QL-163. */
  getUserVersions: (userId: string) =>
    api.get<UserSchedule[]>(`/schedules/user/${userId}/versions`),

  /** Crea una versión nueva de malla (solo ADMIN). QL-163. */
  create: (dto: CreateScheduleDto) => api.post<UserSchedule>('/schedules', dto),

  /** Corrige una versión en sitio (solo ADMIN). QL-163. */
  update: (id: string, dto: UpdateScheduleDto) =>
    api.patch<UserSchedule>(`/schedules/${id}`, dto),

  /** Borra una versión de malla (solo ADMIN). Devuelve la borrada. QL-163. */
  remove: (id: string) => api.delete<UserSchedule>(`/schedules/${id}`),
};
