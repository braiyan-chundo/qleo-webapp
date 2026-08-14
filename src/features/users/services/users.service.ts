import { api } from '@/core/api/fetch-client';
import type { Paginated } from '@/shared/types/paginated';
import type { UserRole } from '@/store/auth.store';

/** DTO de respuesta del backend para un usuario (§3.2). Sin `passwordHash`. */
export interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'ACTIVE' | 'INACTIVE';
  avatarUrl?: string;
  /** QL-32: proxy privado del avatar subido, o `null` si no hay. */
  avatarDownloadUrl?: string | null;
  jobTitle?: string;
  /**
   * QL-193 (§3.66): fecha de nacimiento como **día civil** `'YYYY-MM-DD'`, o `null`.
   *
   * **Trampa del contrato:** el backend la enmascara y solo la sirve a su dueño o a quien
   * administra (ADMIN o Dirección desde QL-195). `null` significa "no tienes permiso para ver
   * el año", **no** "no tiene cumpleaños". Para saber si lo tiene, mira `birthDay`/`birthMonth`,
   * que viajan siempre. En la práctica todas las rutas que devuelven este DTO son del área de
   * administración, así que aquí sí llega completa.
   */
  birthDate?: string | null;
  /** QL-193: día del mes de nacimiento (1–31), o `null` si no tiene fecha. Sin enmascarar. */
  birthDay?: number | null;
  /** QL-193: mes de nacimiento (1–12), o `null` si no tiene fecha. Sin enmascarar. */
  birthMonth?: number | null;
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
  /**
   * QL-198 (§3.70): id del perfil de permisos asignado, o `null`. Se edita con `PATCH /users/:id`.
   */
  profileId?: string | null;
  /**
   * QL-198 (§3.70): resumen del perfil, **para pintar**. Puede llegar con `active: false` (perfil
   * retirado): el usuario lo conserva asignado pero ya no recibe sus permisos.
   *
   * ⚠️ No decidas permisos con `profile.permissions`: deja fuera el rol y los flags individuales.
   */
  profile?: {
    id: string;
    name: string;
    permissions: string[];
    active: boolean;
  } | null;
  /**
   * QL-198 (§3.70): **unión ya calculada** de lo que conceden el rol, los flags individuales y el
   * perfil activo. Es lo que hay que enseñar como "lo que esta persona puede hacer": recalcularlo
   * en el front es el fallo de QL-192 (dos copias de la regla que divergen).
   *
   * `string[]` a propósito: el catálogo del backend crece y una clave desconocida debe viajar sin
   * romper el parseo.
   */
  effectivePermissions?: string[];
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

/** DTO de creación de usuario (§3.2, `POST /users`). **ADMIN o Dirección** (QL-195). */
export interface CreateUserDto {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
  jobTitle?: string;
  /**
   * QL-193 (§3.66): fecha de nacimiento como **día civil** `'YYYY-MM-DD'` literal. Omítela
   * para no fijarla. 400 `BIRTH_DATE_INVALID` / `BIRTH_DATE_IN_FUTURE` / `BIRTH_DATE_OUT_OF_RANGE`.
   */
  birthDate?: string;
  /** QL-127: otorga el permiso de crear proyectos al alta (default `false` en el backend). */
  canCreateProjects?: boolean;
  /** QL-184: permiso de usar el panel de IA al alta (default `true` en el backend si se omite). */
  canUseAi?: boolean;
  /**
   * QL-198 (§3.70): perfil de permisos asignado al alta. **Un solo perfil por usuario** (decisión
   * de producto): selector simple, nunca multi-select. Un perfil retirado da 409
   * `PERMISSION_PROFILE_INACTIVE`.
   */
  profileId?: string | null;
}

/** DTO de actualización de usuario (§3.2, `PATCH /users/:id`). Todos opcionales. */
export interface UpdateUserDto {
  name?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  jobTitle?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  /**
   * QL-193 (§3.66): fecha de nacimiento como **día civil** `'YYYY-MM-DD'` literal; `null`
   * (o `''`) la borra; **ausente** = no se toca. Nunca mandes un ISO con hora: el backend se
   * queda con los 10 primeros caracteres y en UTC-5 eso guarda el día anterior.
   */
  birthDate?: string | null;
  /** QL-127: otorga o revoca el permiso de crear proyectos. */
  canCreateProjects?: boolean;
  /** QL-184: otorga (`true`) o revoca (`false`) el permiso de usar el panel de IA. */
  canUseAi?: boolean;
  /**
   * QL-198 (§3.70): asigna el perfil de permisos, o `null` para quitarlo.
   *
   * ⚠️ Quitar el perfil **no revoca** lo que el usuario tenga concedido por su rol o por sus
   * interruptores individuales: los permisos **suman**. 409 `PERMISSION_PROFILE_INACTIVE` si el
   * perfil está retirado.
   */
  profileId?: string | null;
}

/** Filtros de listado de usuarios (§3.2). **ADMIN o Dirección** (QL-195). */
export interface UserListParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole;
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
  /** Listado completo con paginación. **ADMIN o Dirección** (pantalla de administración). */
  list: (params: UserListParams = {}) => {
    return api.get<Paginated<UserSummary>>(`/users${buildQuery(params)}`);
  },

  /**
   * Crea un usuario fijando el rol de plataforma. **ADMIN o Dirección**. 409 si el email existe.
   *
   * (QL-195) 403 `ROLE_ESCALATION_FORBIDDEN` si Dirección intenta crear un `ADMIN` — lo traduce
   * `userRoleErrorMessage` en `../lib/user-role-errors`.
   */
  create: (dto: CreateUserDto) => {
    return api.post<UserSummary>('/users', dto);
  },

  /** Obtiene un usuario por id. **ADMIN o Dirección**. */
  getById: (id: string) => {
    return api.get<UserSummary>(`/users/${id}`);
  },

  /**
   * Actualiza datos, rol, contraseña o estado. **ADMIN o Dirección**.
   *
   * (QL-195) Tres 403 posibles: `ROLE_ESCALATION_FORBIDDEN` (promover a ADMIN sin serlo),
   * `CANNOT_MANAGE_ADMIN` (Dirección editando a un ADMIN) y `CANNOT_CHANGE_OWN_ROLE`
   * (cambiarse el rol a uno mismo, ni el ADMIN puede). Reenviar el rol **sin cambiarlo** no
   * dispara el último, así que se puede seguir mandando el objeto completo.
   */
  update: (id: string, dto: UpdateUserDto) => {
    return api.patch<UserSummary>(`/users/${id}`, dto);
  },

  /**
   * Desactiva (soft delete → `status: INACTIVE`). **ADMIN o Dirección**.
   *
   * (QL-195) 403 `CANNOT_MANAGE_ADMIN` si Dirección intenta desactivar a un ADMIN.
   */
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

  /**
   * QL-197 — Usuarios de **Dirección** (`MANAGER`/`ADMIN` activos), para elegir a quién pedir la
   * autorización de fecha de fin abierta. Accesible a **cualquier autenticado**, que es justo el
   * motivo de que exista: quien pide la autorización suele ser un MEMBER, y `GET /users` le
   * responde 403. Devuelve la misma forma reducida que el directorio general.
   */
  directives: () => api.get<UserDirectoryEntry[]>('/users/directory/directives'),
};
