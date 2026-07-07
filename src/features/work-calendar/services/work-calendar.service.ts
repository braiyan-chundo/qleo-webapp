import { api } from '@/core/api/fetch-client';

/**
 * Servicio del feature Calendario laboral (QL-10, RF-2.2, §3.12). Define qué días NO son
 * laborables (fines de semana + festivos gestionados por ADMIN) para avisar al elegir la
 * fecha límite de una tarea. El MVP **avisa, no reprograma**. Devuelve `T` directo (el
 * fetch-client ya desenvuelve `{ success, data }` y maneja el 401 global).
 */

/** Festivo configurado por el ADMIN. `date` es el día del festivo en `YYYY-MM-DD`. */
export interface Holiday {
  id: string;
  date: string; // 'YYYY-MM-DD'
  name: string;
  createdAt: string; // ISO8601
}

/** Por qué una fecha NO es laborable. `null` si sí lo es. */
export type NonWorkingReason = 'WEEKEND' | 'HOLIDAY';

/** Resultado de evaluar una fecha con `GET /work-calendar/check`. */
export interface CheckDateResult {
  date: string; // 'YYYY-MM-DD' — la fecha evaluada, normalizada
  isWorkingDay: boolean;
  reason: NonWorkingReason | null; // por qué NO es laborable; null si sí lo es
  nextWorkingDay: string; // 'YYYY-MM-DD' — el mismo día si es laborable; si no, el siguiente hábil
}

/** Filtros opcionales de `GET /work-calendar/holidays` (sin filtros → todos). */
export interface HolidaysParams {
  year?: number;
  from?: string; // ISO
  to?: string; // ISO
}

/** Body de `POST /work-calendar/holidays` (solo ADMIN). */
export interface CreateHolidayDto {
  date: string; // 'YYYY-MM-DD' o ISO8601
  name: string;
}

/** Construye un querystring solo con los params definidos. */
function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export const workCalendarService = {
  /** Evalúa una fecha concreta y sugiere el siguiente día hábil. */
  check: (dateIso: string) =>
    api.get<CheckDateResult>(`/work-calendar/check${buildQuery({ date: dateIso })}`),

  /** Lista los festivos (ordenados por fecha ascendente). */
  listHolidays: (params?: HolidaysParams) =>
    api.get<Holiday[]>(`/work-calendar/holidays${buildQuery({ ...params })}`),

  /** Registra un festivo (solo ADMIN). 409 `HOLIDAY_ALREADY_EXISTS` si ya existe ese día. */
  createHoliday: (dto: CreateHolidayDto) =>
    api.post<Holiday>('/work-calendar/holidays', dto),

  /** Elimina un festivo por id (solo ADMIN). */
  deleteHoliday: (id: string) => api.delete<Holiday>(`/work-calendar/holidays/${id}`),
};
