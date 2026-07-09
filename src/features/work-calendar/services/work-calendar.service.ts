import { api } from '@/core/api/fetch-client';

/**
 * Servicio del feature Calendario laboral (QL-10, RF-2.2, §3.12). Define qué días NO son
 * laborables (fines de semana + festivos gestionados por ADMIN) para avisar al elegir la
 * fecha límite de una tarea. El MVP **avisa, no reprograma**. Devuelve `T` directo (el
 * fetch-client ya desenvuelve `{ success, data }` y maneja el 401 global).
 */

/**
 * Origen de un festivo (QL-68, §3.23): `MANUAL` = alta manual del ADMIN (día extra);
 * `AUTO` = festivo colombiano generado por el sistema (Ley Emiliani + móviles de Pascua).
 * Los `AUTO` no se pueden borrar (se desactivan con `autoColombianHolidays`).
 */
export type HolidaySource = 'MANUAL' | 'AUTO';

/** Festivo del calendario laboral. `date` es el día del festivo en `YYYY-MM-DD`. */
export interface Holiday {
  id: string;
  date: string; // 'YYYY-MM-DD'
  name: string;
  /** (QL-68) origen del festivo. */
  source: HolidaySource;
  /** (QL-68) año del festivo `AUTO`, o `null` en los `MANUAL`. */
  year: number | null;
  createdAt: string; // ISO8601
}

/**
 * Configuración del calendario laboral (QL-68, §3.23). Singleton; se auto-crea con defaults
 * (`weekendDays: [0,6]`, `country: 'CO'`, `autoColombianHolidays: true`) la primera vez.
 */
export interface CalendarConfig {
  /** Días de fin de semana: `0`=Dom … `6`=Sáb. Sin duplicados. */
  weekendDays: number[];
  /** País ISO alpha-2 (2 letras). */
  country: string;
  /** Si `true`, se generan/consideran los festivos colombianos automáticos. */
  autoColombianHolidays: boolean;
}

/** Body parcial de `PATCH /work-calendar/config` (solo ADMIN). */
export type UpdateCalendarConfigDto = Partial<CalendarConfig>;

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

  /** Registra un festivo MANUAL (solo ADMIN). 409 `HOLIDAY_ALREADY_EXISTS` si ya existe ese día. */
  createHoliday: (dto: CreateHolidayDto) =>
    api.post<Holiday>('/work-calendar/holidays', dto),

  /**
   * Elimina un festivo por id (solo ADMIN). Solo festivos `MANUAL`; sobre un `AUTO` → 400
   * `AUTO_HOLIDAY_NOT_DELETABLE`.
   */
  deleteHoliday: (id: string) => api.delete<Holiday>(`/work-calendar/holidays/${id}`),

  /** (QL-68) Lee la config del calendario (singleton). Cualquier autenticado. */
  getConfig: () => api.get<CalendarConfig>('/work-calendar/config'),

  /** (QL-68) Actualiza la config (solo ADMIN). Body parcial; 400 si `weekendDays` inválido. */
  updateConfig: (dto: UpdateCalendarConfigDto) =>
    api.patch<CalendarConfig>('/work-calendar/config', dto),

  /**
   * (QL-68) Genera (idempotente) los festivos colombianos de un año (solo ADMIN). Requiere
   * `autoColombianHolidays=true` (si no → 400). Devuelve los `AUTO` del año ordenados.
   */
  generateHolidays: (year: number) =>
    api.post<Holiday[]>(`/work-calendar/holidays/generate${buildQuery({ year })}`),
};
