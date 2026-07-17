import { api } from '@/core/api/fetch-client';
import type { PaletteKey } from '@/features/tasks/lib/palette';

/**
 * Clave de color de una etiqueta: la misma paleta cerrada Material 3 que usan columnas y
 * proyectos (`PaletteKey`). El backend aplica `'gray'` por defecto, así que en la práctica
 * nunca es `null`; se admite por robustez del contrato (§3.38).
 */
export type LabelColor = PaletteKey;

/**
 * Etiqueta del **catálogo global** (QL-146, §3.38). Es la misma en todo el producto: los
 * proyectos la adoptan (`project.labelIds`) y las tareas la referencian (`task.labelIds`).
 * `icon` es una **clave de lucide-react** (string abierto que el front resuelve a `<Icon/>`,
 * con fallback si no la reconoce); `color` es una clave cerrada de la paleta M3.
 */
export interface Label {
  id: string;
  name: string;
  /** Clave de lucide-react (p. ej. `"plane"`, `"hotel"`, `"tag"`). */
  icon: string;
  /** Clave de paleta M3, o `null` (el backend aplica `'gray'` por defecto). */
  color: LabelColor | null;
  archived: boolean;
  createdAt: string;
}

/** Filtros del catálogo (`GET /labels`, §3.38). */
export interface LabelListParams {
  /** Contiene por nombre (case-insensitive). */
  search?: string;
  /** Incluir archivadas (por defecto solo activas). */
  includeArchived?: boolean;
}

/**
 * Body de `POST /labels` (§3.38). **Get-or-create** por nombre normalizado (trim+lowercase):
 * si ya existe una etiqueta con ese nombre devuelve la existente (no duplica, no lanza 409).
 * `color` omitido → `'gray'` en el backend.
 */
export interface CreateLabelPayload {
  name: string;
  icon: string;
  color?: LabelColor;
}

/**
 * Body de `PATCH /labels/:id` (§3.38, **solo ADMIN**). Todos los campos opcionales (parche
 * parcial). Renombrar a un nombre ya usado → **409 `LABEL_NAME_TAKEN`**. `archived` oculta la
 * etiqueta del picker sin romper referencias.
 */
export interface UpdateLabelPayload {
  name?: string;
  icon?: string;
  color?: LabelColor;
  archived?: boolean;
}

function buildQuery(params: LabelListParams): string {
  const search = new URLSearchParams();
  if (params.search) search.set('search', params.search);
  if (params.includeArchived) search.set('includeArchived', 'true');
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export const labelsService = {
  /** Catálogo (array plano, ordenado por nombre asc). */
  list: (params: LabelListParams = {}) => {
    return api.get<Label[]>(`/labels${buildQuery(params)}`);
  },

  /** Crea (o recupera) una etiqueta por nombre normalizado. Devuelve la etiqueta resultante. */
  create: (data: CreateLabelPayload) => {
    return api.post<Label>('/labels', data);
  },

  /** Cura una etiqueta del catálogo (nombre/icono/color/archivado). Solo ADMIN (§3.38). */
  update: (id: string, data: UpdateLabelPayload) => {
    return api.patch<Label>(`/labels/${id}`, data);
  },

  /**
   * Borra una etiqueta del catálogo en **cascada**: la quita de `project.labelIds` y
   * `task.labelIds` de todo lo que la referenciaba. Solo ADMIN. Devuelve la etiqueta borrada.
   */
  remove: (id: string) => {
    return api.delete<Label>(`/labels/${id}`);
  },
};
