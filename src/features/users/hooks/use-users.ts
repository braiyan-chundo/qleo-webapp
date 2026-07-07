import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  usersService,
  type CreateUserDto,
  type UpdateUserDto,
  type UserListParams,
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

/** Actualiza un usuario e invalida los listados. */
export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateUserDto }) =>
      usersService.update(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
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
