import { api } from '@/core/api/fetch-client';

/**
 * Servicio del feature **Perfiles de permisos** (QL-198, §3.70). Dirección compone perfiles
 * ("Coordinador", "Consultor"…) eligiendo de un **catálogo cerrado** que sirve el backend, y se
 * los asigna a los usuarios (`PATCH /users/:id { profileId }`, en el feature `users`).
 *
 * Todo el CRUD es de Dirección (`MANAGER`+). Devuelve `T` directo: el fetch-client ya desenvuelve
 * `{ success, data }` y maneja el 401 global.
 */

/**
 * Entrada del catálogo (`GET /permission-profiles/catalog`).
 *
 * `label` y `description` **vienen escritos desde el backend**: se pintan tal cual. En los
 * permisos con **alcance** la `description` *es* donde vive ese alcance ("únicamente en los
 * proyectos donde el usuario es miembro"); recortarla haría creer que se concede más de lo que
 * se concede.
 *
 * `key` se tipa como `string` a propósito: el catálogo es cerrado **en el backend** pero
 * **crece**, y la UI debe renderizar lo que llegue sin conocer las claves de antemano.
 */
export interface PermissionCatalogItem {
  key: string;
  label: string;
  description: string;
  /** Sección del editor (`Proyectos`, `Tareas`, `Catálogos`, `Muro`, `Inteligencia artificial`…). */
  group: string;
  /**
   * Interruptor individual equivalente en el usuario (`canCreateProjects`, `canUseAi`), o `null`.
   * Los permisos añadidos en QL-198b lo tienen a `null` a propósito: solo se conceden por perfil
   * (o por rol), porque nunca existieron como flag suelto.
   */
  legacyFlag: string | null;
}

/** Perfil de permisos (`PermissionProfileResponseDto`, §3.70 §2). */
export interface PermissionProfile {
  id: string;
  name: string;
  description: string | null;
  /** Claves del catálogo concedidas por este perfil. */
  permissions: string[];
  /**
   * `false` = **retirado**. No solo deja de ofrecerse: **deja de conceder** sus permisos a quien
   * ya lo tiene (§3.70 §4). Es reversible.
   */
  active: boolean;
  /** Usuarios que lo tienen asignado, en cualquier estado. */
  usersCount: number;
  createdAt: string; // ISO8601
  updatedAt: string; // ISO8601
}

/** Body de `POST /permission-profiles`. Sin `permissions` el perfil nace vacío (válido). */
export interface CreatePermissionProfileDto {
  name: string;
  description?: string;
  permissions?: string[];
}

/**
 * Body de `PATCH /permission-profiles/:id`. Todos opcionales.
 *
 * ⚠️ **`permissions` REEMPLAZA la lista entera**, no hace merge: manda siempre el estado completo
 * del formulario de casillas. `[]` deja el perfil sin ningún permiso.
 */
export interface UpdatePermissionProfileDto {
  name?: string;
  description?: string;
  permissions?: string[];
  active?: boolean;
}

/** Filtros de `GET /permission-profiles` (array **sin paginar**). */
export interface PermissionProfileListParams {
  /** Añade los perfiles retirados (`active: false`), que por defecto no salen. */
  includeInactive?: boolean;
  /** Filtra por nombre. */
  search?: string;
}

function buildQuery(params: PermissionProfileListParams): string {
  const qs = new URLSearchParams();
  if (params.includeInactive) qs.set('includeInactive', 'true');
  if (params.search?.trim()) qs.set('search', params.search.trim());
  const query = qs.toString();
  return query ? `?${query}` : '';
}

export const permissionProfilesService = {
  /**
   * Catálogo de permisos disponibles. **No lo hardcodees**: una copia desactualizada ofrecería
   * claves que el backend rechaza con 400 `PERMISSION_INVALID`.
   */
  catalog: () => api.get<PermissionCatalogItem[]>('/permission-profiles/catalog'),

  /** Lista de perfiles (sin paginar). Solo activos salvo `includeInactive`. */
  list: (params: PermissionProfileListParams = {}) =>
    api.get<PermissionProfile[]>(`/permission-profiles${buildQuery(params)}`),

  /** Detalle de un perfil, con `usersCount` fresco. */
  getById: (id: string) => api.get<PermissionProfile>(`/permission-profiles/${id}`),

  /** Crea un perfil. 409 `PERMISSION_PROFILE_NAME_TAKEN`, 400 `PERMISSION_INVALID`. */
  create: (dto: CreatePermissionProfileDto) =>
    api.post<PermissionProfile>('/permission-profiles', dto),

  /** Edita un perfil (incluido `active`). Mismos errores que el alta. */
  update: (id: string, dto: UpdatePermissionProfileDto) =>
    api.patch<PermissionProfile>(`/permission-profiles/${id}`, dto),

  /**
   * Borra un perfil. **409 `PERMISSION_PROFILE_IN_USE`** si lo tiene alguien asignado: no hay
   * cascada, hay que reasignar antes (o retirarlo, que es reversible). El recuento viaja dentro
   * del `message` del error.
   */
  remove: (id: string) => api.delete<PermissionProfile>(`/permission-profiles/${id}`),
};
