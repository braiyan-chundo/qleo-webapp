import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { authKeys } from '@/features/auth/hooks/use-auth';
import { userKeys } from '@/features/users/hooks/use-users';

import {
  permissionProfilesService,
  type CreatePermissionProfileDto,
  type PermissionCatalogItem,
  type PermissionProfileListParams,
  type UpdatePermissionProfileDto,
} from '../services/permission-profiles.service';

/**
 * Hooks de datos del feature **Perfiles de permisos** (QL-198, §3.70). Todo dato del servidor
 * pasa por aquí; los componentes usan estos hooks y nunca llaman al service.
 *
 * **Toda mutación de permisos invalida también el usuario** (`['users']` y `['auth','me']`): no
 * hay evento de tiempo real para los perfiles (§3.70 §7), así que el cliente solo se entera en su
 * siguiente refetch. La API, en cambio, aplica el cambio al instante —cada gate relee la BD—, y sin
 * la invalidación el usuario seguiría viendo botones que ya responden 403.
 */

/** Claves de query del feature. Centralizadas para invalidación consistente. */
export const permissionProfileKeys = {
  all: ['permission-profiles'] as const,
  catalog: () => [...permissionProfileKeys.all, 'catalog'] as const,
  lists: () => [...permissionProfileKeys.all, 'list'] as const,
  list: (params: PermissionProfileListParams) =>
    [...permissionProfileKeys.lists(), params] as const,
};

/**
 * Catálogo de permisos (§3.70 §1). Es **cerrado y estable dentro de la sesión** → `staleTime`
 * alto, igual que el resto de catálogos (turnos, festivos).
 */
export function usePermissionCatalog({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: permissionProfileKeys.catalog(),
    queryFn: () => permissionProfilesService.catalog(),
    enabled,
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * Agrupa el catálogo por `group` **conservando el orden de aparición** del array. Las secciones
 * se derivan de la respuesta, nunca de una lista fija en el front: así un permiso de un grupo
 * nuevo aparece solo, sin tocar la UI.
 */
export function groupCatalog(
  catalog: PermissionCatalogItem[] | undefined,
): { group: string; items: PermissionCatalogItem[] }[] {
  const groups = new Map<string, PermissionCatalogItem[]>();
  for (const item of catalog ?? []) {
    const bucket = groups.get(item.group);
    if (bucket) bucket.push(item);
    else groups.set(item.group, [item]);
  }
  return [...groups].map(([group, items]) => ({ group, items }));
}

/** Igual que {@link groupCatalog}, memoizado para usarlo en render. */
export function useGroupedCatalog(catalog: PermissionCatalogItem[] | undefined) {
  return useMemo(() => groupCatalog(catalog), [catalog]);
}

/**
 * Índice `key → entrada del catálogo`, para resolver el `label` de un permiso guardado en un
 * perfil o en `effectivePermissions`. Una clave que no esté en el catálogo (permiso nuevo del
 * backend, catálogo aún cargando) simplemente no se resuelve: el consumidor cae a la clave cruda
 * en vez de esconder el permiso.
 */
export function usePermissionLabels(
  catalog: PermissionCatalogItem[] | undefined,
): Map<string, PermissionCatalogItem> {
  return useMemo(
    () => new Map((catalog ?? []).map((item) => [item.key, item])),
    [catalog],
  );
}

/** Lista de perfiles (array sin paginar). El editor la pide con `includeInactive` para ver los retirados. */
export function usePermissionProfiles(
  params: PermissionProfileListParams = {},
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: permissionProfileKeys.list(params),
    queryFn: () => permissionProfilesService.list(params),
    enabled,
  });
}

/** Invalida los perfiles **y** el usuario (permisos efectivos), tras cualquier mutación. */
function useInvalidatePermissions() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: permissionProfileKeys.all });
    queryClient.invalidateQueries({ queryKey: userKeys.all });
    queryClient.invalidateQueries({ queryKey: authKeys.profile });
  };
}

/** Crea un perfil. 409 `PERMISSION_PROFILE_NAME_TAKEN`, 400 `PERMISSION_INVALID`. */
export function useCreatePermissionProfile() {
  const invalidate = useInvalidatePermissions();

  return useMutation({
    mutationFn: (dto: CreatePermissionProfileDto) =>
      permissionProfilesService.create(dto),
    onSuccess: invalidate,
  });
}

/**
 * Edita un perfil. Cubre también **retirar/reactivar** (`active`), que no es cosmético: un perfil
 * retirado deja de conceder sus permisos a quien ya lo tiene (§3.70 §4).
 */
export function useUpdatePermissionProfile() {
  const invalidate = useInvalidatePermissions();

  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdatePermissionProfileDto }) =>
      permissionProfilesService.update(id, dto),
    onSuccess: invalidate,
  });
}

/** Borra un perfil. 409 `PERMISSION_PROFILE_IN_USE` si lo tiene alguien asignado. */
export function useDeletePermissionProfile() {
  const invalidate = useInvalidatePermissions();

  return useMutation({
    mutationFn: (id: string) => permissionProfilesService.remove(id),
    onSuccess: invalidate,
  });
}
