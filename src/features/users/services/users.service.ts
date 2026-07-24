import { api } from '@/core/api/fetch-client';
import type { Paginated } from '@/shared/types/paginated';

/** DTO de respuesta del backend para un usuario (§3.2). Sin `passwordHash`. */
export interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
  status: 'ACTIVE' | 'INACTIVE';
  avatarUrl?: string;
  /** QL-32: proxy privado del avatar subido, o `null` si no hay. */
  avatarDownloadUrl?: string | null;
  jobTitle?: string;
  /**
   * QL-127: permiso otorgado al MEMBER para crear proyectos (default `false`). Un ADMIN
   * siempre puede, sea cual sea el flag → resolver con `canCreateProjects()` de
   * `@/shared/lib/permissions`. No viene en `GET /users/directory` (superficie mínima).
   */
  canCreateProjects?: boolean;
  /**
   * QL-184: permiso de plataforma para usar el panel de IA (default `true`). Un ADMIN lo revoca
   * poniéndolo en `false`. Si el campo no viene (usuario antiguo), trátalo como `true`. Resolver el
   * permiso efectivo con `canUseAi()` de `@/shared/lib/permissions`. No viene en `GET /users/directory`.
   */
  canUseAi?: boolean;
  createdAt: string;
}

/** Entrada del directorio de usuarios (§3.2, `GET /users/directory`). Solo ACTIVOS. */
export interface UserDirectoryEntry {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  /** QL-32: proxy privado del avatar subido, o `null` si no hay. */
  avatarDownloadUrl?: string | null;
  jobTitle?: string;
}

/** DTO de creación de usuario (§3.2, `POST /users`). Solo `ADMIN`. */
export interface CreateUserDto {
  name: string;
  email: string;
  password: string;
  role?: 'ADMIN' | 'MEMBER';
  jobTitle?: string;
  /** QL-127: otorga el permiso de crear proyectos al alta (default `false` en el backend). */
  canCreateProjects?: boolean;
  /** QL-184: permiso de usar el panel de IA al alta (default `true` en el backend si se omite). */
  canUseAi?: boolean;
}

/** DTO de actualización de usuario (§3.2, `PATCH /users/:id`). Todos opcionales. */
export interface UpdateUserDto {
  name?: string;
  email?: string;
  password?: string;
  role?: 'ADMIN' | 'MEMBER';
  jobTitle?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  /** QL-127: otorga o revoca el permiso de crear proyectos. */
  canCreateProjects?: boolean;
  /** QL-184: otorga (`true`) o revoca (`false`) el permiso de usar el panel de IA. */
  canUseAi?: boolean;
}

/** Filtros de listado de usuarios (§3.2). Solo `ADMIN` puede consultarlo. */
export interface UserListParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: 'ADMIN' | 'MEMBER';
  status?: 'ACTIVE' | 'INACTIVE';
}

function buildQuery(params: UserListParams): string {
  const search = new URLSearchParams();
  if (params.page != null) search.set('page', String(params.page));
  if (params.limit != null) search.set('limit', String(params.limit));
  if (params.search) search.set('search', params.search);
  if (params.role) search.set('role', params.role);
  if (params.status) search.set('status', params.status);
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export const usersService = {
  /** Listado completo con paginación. **Solo ADMIN** (pantalla de administración). */
  list: (params: UserListParams = {}) => {
    return api.get<Paginated<UserSummary>>(`/users${buildQuery(params)}`);
  },

  /** Crea un usuario fijando el rol de plataforma. **Solo ADMIN**. 409 si el email existe. */
  create: (dto: CreateUserDto) => {
    return api.post<UserSummary>('/users', dto);
  },

  /** Obtiene un usuario por id. **Solo ADMIN**. */
  getById: (id: string) => {
    return api.get<UserSummary>(`/users/${id}`);
  },

  /** Actualiza datos, rol, contraseña o estado. **Solo ADMIN**. */
  update: (id: string, dto: UpdateUserDto) => {
    return api.patch<UserSummary>(`/users/${id}`, dto);
  },

  /** Desactiva (soft delete → `status: INACTIVE`). **Solo ADMIN**. */
  remove: (id: string) => {
    return api.delete<UserSummary>(`/users/${id}`);
  },

  /**
   * Directorio de usuarios activos para pickers (§3.2). Accesible a **cualquier
   * autenticado**. Devuelve un array simple (sin envoltorio de paginación),
   * ordenado por `name` asc. `limit` def. 10, máx. 50.
   */
  directory: (search?: string, limit = 10) => {
    const qs = new URLSearchParams();
    if (search?.trim()) qs.set('search', search.trim());
    qs.set('limit', String(limit));
    return api.get<UserDirectoryEntry[]>(`/users/directory?${qs.toString()}`);
  },
};
