import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { authKeys } from '@/features/auth/hooks/use-auth';

import {
  usersService,
  type CreateUserDto,
  type UpdateUserDto,
  type UserListParams,
  type UserSummary,
} from '../services/users.service';

/**
 * Hooks de datos del feature Usuarios. El picker de roles por tarea consume
 * `GET /users/directory` (§3.2), accesible a **cualquier autenticado**; el listado
 * paginado `GET /users` y las mutaciones de administración (crear/editar/desactivar)
 * son **solo ADMIN** y alimentan la pantalla `/admin`.
 */

/** Claves de query del feature. Centralizadas para invalidación consistente. */
export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (params: UserListParams) => [...userKeys.lists(), params] as const,
  directories: () => [...userKeys.all, 'directory'] as const,
  directory: (search: string) => [...userKeys.directories(), search] as const,
  /** (QL-197) Usuarios ACTIVOS con rol de Dirección, para el selector de autorización. */
  directives: () => [...userKeys.all, 'directives'] as const,
};

interface UseUserDirectoryOptions {
  /** Controla si la query se dispara (p. ej. solo cuando el picker está visible). */
  enabled?: boolean;
}

/**
 * Directorio de usuarios activos para el selector de roles por tarea. No requiere rol
 * de plataforma: cualquier CREATOR (ADMIN o MEMBER) puede buscar participantes.
 */
export function useUserDirectory(
  search: string,
  { enabled = true }: UseUserDirectoryOptions = {},
) {
  const term = search.trim();

  return useQuery({
    queryKey: userKeys.directory(term),
    queryFn: () => usersService.directory(term || undefined, 50),
    enabled,
  });
}

/**
 * (QL-197, §3.69) Candidatos del selector de **directivo** al pedir autorización para dejar la
 * fecha de fin abierta. El backend solo acepta un `managerId` que sea usuario **ACTIVO** con rol
 * `MANAGER` **o** `ADMIN` (`hasAtLeastRole(...,'MANAGER')`), y si no responde 400
 * `OPEN_ENDED_MANAGER_INVALID` **sin crear la tarea**.
 *
 * Sale de `GET /users/directory/directives`, que el backend expuso **para esto**: quien pide la
 * autorización es normalmente un **MEMBER**, y con `GET /users` (que es `@Roles(MANAGER)`) se
 * habría comido un 403. El endpoint está abierto a cualquier autenticado y devuelve la forma
 * reducida del directorio —sin `role` ni `status`—, porque pertenecer a Dirección ya va implícito
 * en salir de esa lista.
 *
 * Una sola petición: el backend ya une `MANAGER` + `ADMIN`. Filtrar en cliente nunca fue una
 * opción — el directorio general omite `role` a propósito, así que el dato no llega.
 */
export function useDirectiveUsers({ enabled = true }: { enabled?: boolean } = {}) {
  const query = useQuery({
    queryKey: userKeys.directives(),
    queryFn: async (): Promise<UserSummary[]> => {
      const directives = await usersService.directives();
      return directives.map((entry) => ({
        id: entry.id,
        name: entry.name,
        email: entry.email,
        avatarUrl: entry.avatarUrl,
        avatarDownloadUrl: entry.avatarDownloadUrl,
        jobTitle: entry.jobTitle,
      })) as UserSummary[];
    },
    enabled,
  });

  return query;
}

/** Listado paginado de usuarios para la tabla de administración (`GET /users`, ADMIN). */
export function useUsersList(params: UserListParams) {
  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: () => usersService.list(params),
  });
}

/** Crea un usuario e invalida los listados. */
export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateUserDto) => usersService.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}

/**
 * Actualiza un usuario e invalida los listados.
 *
 * (QL-198, §3.70 §7) Invalida también `['auth','me']`: la edición puede cambiar permisos (perfil
 * o interruptores individuales) y no hay evento de tiempo real para eso. Si quien edita se está
 * editando a sí mismo, sin esto seguiría viendo su nav y sus botones con los permisos anteriores
 * —que la API ya está rechazando, porque cada gate relee la BD— hasta el siguiente arranque.
 */
export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateUserDto }) =>
      usersService.update(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      queryClient.invalidateQueries({ queryKey: authKeys.profile });
    },
  });
}

/** Desactiva (soft delete) un usuario e invalida los listados. */
export function useDeactivateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => usersService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}
