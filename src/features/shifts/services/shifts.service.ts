import { api } from '@/core/api/fetch-client';

/**
 * Servicio del feature Turnos (QL-158, §3.46). Primera pieza del epic **Turnos y mallas
 * horarias por usuario** (Lote Y). Un **turno** (`Shift`) es una franja horaria con nombre,
 * reutilizable, que las mallas (`UserSchedule`, §3.48) asignan por día de la semana y el
 * calendario pinta (QL-162/163). Es un **catálogo global** (no cuelga de proyecto).
 *
 * Devuelve `T` directo: el fetch-client ya desenvuelve `{ success, data }` y maneja el 401.
 */

/**
 * Turno del catálogo. Los minutos son **minutos desde la medianoche local** (0..1440); un turno
 * vive dentro del mismo día (`startMinute < endMinute`, no cruza medianoche). Un descanso se
 * modela como el hueco entre dos turnos, no hay campo de break. Ej.: `480 = 08:00`, `720 = 12:00`.
 */
export interface Shift {
  id: string;
  name: string;
  /** 0..1440, minutos desde la medianoche local. */
  startMinute: number;
  /** 0..1440, siempre > `startMinute`. */
  endMinute: number;
  /** Hex `#RRGGBB` (definido por el usuario) o `null` si no se fijó. */
  color: string | null;
  /** `false` = turno "retirado": no se ofrece en mallas nuevas. */
  active: boolean;
  createdAt: string; // ISO8601
}

/**
 * Body de `POST /shifts` (solo ADMIN, §3.46). `name` único case-insensitive; `color` opcional
 * (hex `#RRGGBB`), ausente → `null`. Al crear, `active` arranca en `true`. Lo consume QL-163.
 */
export interface CreateShiftDto {
  name: string;
  startMinute: number;
  endMinute: number;
  color?: string;
}

/**
 * Body de `PATCH /shifts/:id` (solo ADMIN, §3.46). Todos opcionales (parche parcial). `color`
 * a `null` **quita** el color; omitirlo no lo toca. `active:false` retira, `true` reactiva. Si
 * cambian los minutos, el rango se revalida contra el valor efectivo. Lo consume QL-163.
 */
export interface UpdateShiftDto {
  name?: string;
  startMinute?: number;
  endMinute?: number;
  color?: string | null;
  active?: boolean;
}

export const shiftsService = {
  /**
   * Catálogo de turnos (§3.46). Por defecto solo los activos; `includeInactive` añade los
   * retirados. Orden del backend: por `startMinute`, luego `name`.
   */
  list: (includeInactive = false) =>
    api.get<Shift[]>(`/shifts${includeInactive ? '?includeInactive=true' : ''}`),

  /** Crea un turno (solo ADMIN). 409 `SHIFT_NAME_TAKEN`, 400 `SHIFT_INVALID_RANGE`. QL-163. */
  create: (dto: CreateShiftDto) => api.post<Shift>('/shifts', dto),

  /** Edita un turno (solo ADMIN). 400 `SHIFT_INVALID_RANGE`, 409 `SHIFT_NAME_TAKEN`. QL-163. */
  update: (id: string, dto: UpdateShiftDto) => api.patch<Shift>(`/shifts/${id}`, dto),

  /** Borra un turno por id (solo ADMIN). Devuelve el turno borrado. QL-163. */
  remove: (id: string) => api.delete<Shift>(`/shifts/${id}`),
};
