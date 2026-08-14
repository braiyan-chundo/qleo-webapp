import { api } from '@/core/api/fetch-client';
import type { Paginated } from '@/shared/types/paginated';

/**
 * Servicio del feature **Ausencias** (QL-199, §3.71). Registra los periodos en los que alguien no
 * está disponible (vacaciones, permisos, incapacidades, fuera de oficina) para que Qleo pueda
 * **avisar** — nunca bloquear.
 *
 * ## Dos superficies, y no se mezclan
 *
 * | | CRUD `/absences` | `/who-is-out` y `/calendar` |
 * |---|---|---|
 * | **Quién** | Dirección (`MANAGER`+) | cualquier autenticado |
 * | **Tipo** | real siempre | **enmascarado** si es reservado |
 * | **Nota** | sí | **nunca, para nadie** |
 *
 * El enmascarado lo hace el backend, automático: `type`/`typeLabel` llegan ya resueltos para quien
 * pregunta. Fuera de la pantalla de Dirección, **pinta lo que venga y solo lo que venga**: no
 * deduzcas el tipo real ni muestres nada que la API no haya dado.
 *
 * Devuelve `T` directo (el fetch-client ya desenvuelve `{ success, data }`).
 */

/** Tipo real de ausencia. Solo aparece en el CRUD de Dirección (o en la ausencia propia). */
export type AbsenceType =
  | 'VACATION'
  | 'LEAVE'
  | 'SICK_LEAVE'
  | 'OUT_OF_OFFICE'
  | 'OTHER';

/**
 * Lo que un tercero ve cuando el tipo real es reservado.
 *
 * ⚠️ **No lo pintes como una incapacidad**, ni con iconografía médica, ni con un "motivo
 * reservado" que invite a suponerlo. Son **tres** los tipos que caen aquí (`LEAVE`, `SICK_LEAVE`,
 * `OTHER`) precisamente para que no se pueda deducir cuál es. Significa literalmente "no está
 * disponible".
 */
export const MASKED_ABSENCE_TYPE = 'UNAVAILABLE';

/** Tipo tal y como puede llegar por un canal abierto: uno real, o la máscara. */
export type PublicAbsenceType = AbsenceType | typeof MASKED_ABSENCE_TYPE;

/** Entrada del catálogo (`GET /absences/types`, Dirección). Textos ya escritos: píntalos tal cual. */
export interface AbsenceTypeCatalogItem {
  key: AbsenceType;
  label: string;
  description: string;
  /** `true` ⇒ a terceros se les enseña "No disponible". Márcalo en el formulario. */
  sensitive: boolean;
}

/** Persona reducida que acompaña a una ausencia. */
export interface AbsencePerson {
  id: string;
  name: string;
  avatarDownloadUrl: string | null;
}

/**
 * Ausencia completa (`AbsenceResponseDto`). **Única forma que lleva la nota y el tipo sin
 * enmascarar**: solo sale del CRUD de Dirección. No la reutilices en otras pantallas.
 */
export interface Absence {
  id: string;
  userId: string;
  user: AbsencePerson;
  type: AbsenceType;
  typeLabel: string;
  /** Primer día ausente, `'YYYY-MM-DD'`. */
  from: string;
  /** Último día ausente, **INCLUSIVO**, `'YYYY-MM-DD'`. Del 10 al 10 es un día. */
  to: string;
  /** Primer día en que vuelve (`to` + 1). Ya resuelto por el backend. */
  returnsOn: string;
  /** Días civiles, ambos extremos incluidos. */
  days: number;
  /** Nota interna de Dirección. **No la enseñes fuera de esta pantalla.** */
  note: string | null;
  createdBy: AbsencePerson | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Un periodo de ausencia visto por un tercero: sin nota y con el tipo enmascarado si era
 * reservado.
 */
export interface PublicAbsencePeriod {
  id: string;
  type: PublicAbsenceType;
  typeLabel: string;
  from: string;
  to: string;
}

/**
 * Una **persona** ausente dentro del rango consultado, con sus periodos ya agrupados
 * (`GET /absences/who-is-out`). Agrupado por persona a propósito: es lo que evita una petición
 * por candidato al pintar el selector de responsables.
 */
export interface AbsentUser {
  userId: string;
  name: string;
  avatarDownloadUrl: string | null;
  /** Periodos que explican la ausencia, ordenados por `from`. */
  periods: PublicAbsencePeriod[];
  /** Primer día ausente del conjunto. **Puede ser anterior al rango pedido** (es intencionado). */
  from: string;
  /** Último día ausente del conjunto. Puede ser posterior al rango pedido. */
  to: string;
  /**
   * Primer día en que la persona VUELVE, **ya encadenado**: si unas vacaciones del 10 al 20
   * continúan con otra ausencia del 21 al 25, vale `2026-08-26`, no el 21.
   *
   * ⚠️ **Úsalo siempre; nunca sumes un día al `to` de un periodo suelto.** Ese cálculo a mano es
   * exactamente lo que produce el aviso "vuelve el 21" siendo mentira.
   */
  returnsOn: string;
  /** `true` = ausente **todos** los días del rango; `false` = solo parte, o con huecos. */
  coversWholeRange: boolean;
}

/**
 * Ausencia a pintar en el calendario (`GET /absences/calendar`). Es un **rango** (`from`/`to`), no
 * un día suelto como festivos y cumpleaños, y llega **sin recortar** al rango pedido: así se puede
 * dibujar "viene de antes" / "sigue después" sin otra llamada.
 */
export interface AbsenceCalendarItem {
  id: string;
  userId: string;
  name: string;
  avatarDownloadUrl: string | null;
  type: PublicAbsenceType;
  typeLabel: string;
  from: string;
  to: string;
  /** `to` + 1 **de esta ausencia**, sin encadenar (el encadenado vive en `who-is-out`). */
  returnsOn: string;
  days: number;
}

/** Body de `POST /absences` (Dirección). Días civiles `'YYYY-MM-DD'`, nunca un ISO con hora. */
export interface CreateAbsenceDto {
  userId: string;
  type: AbsenceType;
  from: string;
  to: string;
  note?: string;
}

/** Body de `PATCH /absences/:id`. **`userId` NO es editable**: para cambiar de persona, borrar y crear. */
export interface UpdateAbsenceDto {
  type?: AbsenceType;
  from?: string;
  to?: string;
  /** `null` borra la nota; omitirlo no la toca. */
  note?: string | null;
}

/** Filtros del listado de Dirección. Sin filtros devuelve **todas**, pasadas y futuras. */
export interface AbsenceListParams {
  page?: number;
  limit?: number;
  userId?: string;
  type?: AbsenceType;
  /** Filtran por **solape**, no por contención. */
  from?: string;
  to?: string;
  /** Busca en nombre o correo de la persona ausente; **no** en la nota. */
  search?: string;
}

/** Params de `who-is-out`. Ambos opcionales; sin nada, hoy. Máximo **366 días**. */
export interface WhoIsOutParams {
  from?: string;
  to?: string;
}

/** Params del calendario: `year`, o el par `from`/`to`. Máximo **366 días**. */
export interface AbsenceCalendarParams {
  year?: number;
  from?: string;
  to?: string;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export const absencesService = {
  /** Catálogo cerrado de tipos (Dirección). Renderiza el selector **desde aquí**, no de una copia. */
  types: () => api.get<AbsenceTypeCatalogItem[]>('/absences/types'),

  /** Listado paginado para la pantalla de Dirección. Orden: `from` descendente. */
  list: (params: AbsenceListParams = {}) =>
    api.get<Paginated<Absence>>(`/absences${buildQuery({ ...params })}`),

  /** Detalle de una ausencia (Dirección). */
  getById: (id: string) => api.get<Absence>(`/absences/${id}`),

  /** Crea una ausencia (Dirección). 409 `ABSENCE_OVERLAP` si ya hay una del **mismo tipo**. */
  create: (dto: CreateAbsenceDto) => api.post<Absence>('/absences', dto),

  /** Edita una ausencia (Dirección). Mismas validaciones de rango y solape. */
  update: (id: string, dto: UpdateAbsenceDto) =>
    api.patch<Absence>(`/absences/${id}`, dto),

  /** Borra una ausencia (Dirección). Devuelve la borrada. */
  remove: (id: string) => api.delete<Absence>(`/absences/${id}`),

  /**
   * Quién no está en el rango, **agrupado por persona**. Cualquier autenticado; tipos
   * enmascarados y sin nota. Alimenta el aviso del formulario de tarea.
   */
  whoIsOut: (params: WhoIsOutParams = {}) =>
    api.get<AbsentUser[]>(`/absences/who-is-out${buildQuery({ ...params })}`),

  /** Ausencias del rango para pintar el calendario. Cualquier autenticado; mismas reglas. */
  calendar: (params: AbsenceCalendarParams = {}) =>
    api.get<AbsenceCalendarItem[]>(`/absences/calendar${buildQuery({ ...params })}`),
};
