import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAvatarMutationCommit } from '@/features/profile/hooks/use-profile';
import { prepareAvatarUpload } from '@/shared/lib/avatar-file';
import { useAuthStore } from '@/store/auth.store';

import {
  avatarsService,
  type RenameAvatarPayload,
} from '../services/avatars.service';

/**
 * Hooks de datos del **catálogo global de avatares** (QL-181, §3.59). Toda la interacción con
 * la API pasa por aquí; los componentes usan estos hooks y nunca llaman al service.
 *
 * **El catálogo NO emite realtime** (§3.59): no hay `entity: 'avatar'` en el bus, así que tras
 * crear/renombrar/borrar hay que invalidar la query nosotros. Otros clientes lo verán en su
 * siguiente refetch.
 */

/** Claves de query del feature. */
export const avatarKeys = {
  all: ['avatars'] as const,
  list: () => [...avatarKeys.all, 'list'] as const,
};

interface UseAvatarCatalogOptions {
  /** Controla si la query se dispara (p. ej. solo con el selector abierto). */
  enabled?: boolean;
}

/**
 * Catálogo completo de avatares. No requiere rol de plataforma: cualquier autenticado puede
 * leerlo para elegir su foto. No pagina (array plano ordenado por `createdAt` asc).
 */
export function useAvatarCatalog({ enabled = true }: UseAvatarCatalogOptions = {}) {
  return useQuery({
    queryKey: avatarKeys.list(),
    queryFn: () => avatarsService.list(),
    enabled,
  });
}

/** Variables de la subida al catálogo: el archivo y un nombre opcional. */
export interface CreateCatalogAvatarVars {
  file: File;
  name?: string;
}

/**
 * Sube **un** avatar al catálogo (solo ADMIN). La imagen se comprime en cliente (256×256 WebP)
 * dentro del `mutationFn`, igual que la foto de perfil.
 *
 * Un archivo por request (§3.59): el lote se sube en bucle con concurrencia limitada desde el
 * panel, de forma que un archivo rechazado no tumba el resto.
 */
export function useCreateCatalogAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, name }: CreateCatalogAvatarVars) =>
      avatarsService.create(await prepareAvatarUpload(file), name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: avatarKeys.list() });
    },
  });
}

/** Renombra un avatar del catálogo (solo ADMIN). */
export function useRenameCatalogAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: RenameAvatarPayload }) =>
      avatarsService.rename(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: avatarKeys.list() });
    },
  });
}

/**
 * Borra un avatar del catálogo (solo ADMIN). Quien ya lo hubiera elegido **conserva su foto**:
 * el backend copió el binario al almacén del usuario, no lo referencia.
 */
export function useDeleteCatalogAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => avatarsService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: avatarKeys.list() });
    },
  });
}

/**
 * Elige un avatar del catálogo como foto propia. Cierra **exactamente igual** que subir una
 * foto (perfil + sesión + directorio + blob del avatar, viejo y nuevo) porque para el backend
 * es lo mismo: copia el binario y emite el mismo evento realtime `user-avatar` (§3.59).
 *
 * Si el ADMIN borró ese avatar mientras el selector estaba abierto llega **404
 * `AVATAR_NOT_FOUND`**: es un caso normal, el llamador refresca el catálogo y pide elegir otro.
 */
export function useChooseAvatarFromCatalog() {
  const commit = useAvatarMutationCommit();
  const previousDownloadUrl = useAuthStore((s) => s.user?.avatarDownloadUrl);

  return useMutation({
    mutationFn: (avatarId: string) => avatarsService.chooseFromCatalog(avatarId),
    onSuccess: (user) => commit(user, previousDownloadUrl),
  });
}
