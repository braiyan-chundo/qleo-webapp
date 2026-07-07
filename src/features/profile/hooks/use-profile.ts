import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  profileService,
  type ChangePasswordPayload,
  type UpdateMePayload,
} from '../services/profile.service';
import { authKeys } from '@/features/auth/hooks/use-auth';
import { useResetAvatarCache } from '@/shared/hooks/use-authed-avatar';
import { useAuthStore } from '@/store/auth.store';
import type { User } from '@/store/auth.store';

/**
 * Hooks de datos del feature Perfil (QL-26, §3.15). Toda la interacción con la API pasa
 * por aquí: la página usa estos hooks y nunca llama al service ni maneja loading/error a
 * mano. Sigue el patrón de `features/auth/hooks/use-auth.ts`.
 */

/** Claves de query del feature. */
export const profileKeys = {
  me: ['profile', 'me'] as const,
};

/** Perfil del usuario autenticado. Hidrata también el store de sesión (avatar/nombre). */
export function useMyProfile() {
  const token = useAuthStore((s) => s.accessToken);
  const setUser = useAuthStore((s) => s.setUser);

  return useQuery({
    queryKey: profileKeys.me,
    queryFn: async () => {
      const user = await profileService.getMe();
      setUser(user);
      return user;
    },
    enabled: !!token,
  });
}

/** Actualiza los datos del perfil; refresca la sesión y el caché de perfil/auth. */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation({
    mutationFn: (data: UpdateMePayload) => profileService.updateMe(data),
    onSuccess: (user) => {
      setUser(user);
      queryClient.setQueryData(profileKeys.me, user);
      queryClient.invalidateQueries({ queryKey: authKeys.profile });
    },
  });
}

/**
 * Cambia la contraseña. No toca la sesión (no devuelve token nuevo). El error
 * `INVALID_CURRENT_PASSWORD` se detecta en la página vía `ApiError.code`.
 */
export function useChangePassword() {
  return useMutation({
    mutationFn: (data: ChangePasswordPayload) =>
      profileService.changePassword(data),
  });
}

/**
 * Refresca la sesión, el caché de perfil/auth y **el blob del avatar** tras subir o quitar
 * la foto, para que se refleje al instante en toda la app (topbar, listas, comentarios…).
 * `previousDownloadUrl` es la URL antes del cambio: hay que invalidar el blob viejo además
 * del nuevo (mismo endpoint, ETag distinto tras subir).
 */
function useAvatarMutationCommit() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  const resetAvatarCache = useResetAvatarCache();

  return (user: User, previousDownloadUrl?: string | null) => {
    setUser(user);
    queryClient.setQueryData(profileKeys.me, user);
    queryClient.invalidateQueries({ queryKey: authKeys.profile });
    // El directorio y las tareas traen `avatarDownloadUrl` del usuario → refréscalos también.
    queryClient.invalidateQueries({ queryKey: ['users', 'directory'] });
    resetAvatarCache(previousDownloadUrl);
    resetAvatarCache(user.avatarDownloadUrl);
  };
}

/** Sube/reemplaza el avatar del propio perfil. Invalida perfil, sesión y caché del blob. */
export function useUploadAvatar() {
  const commit = useAvatarMutationCommit();
  const previousDownloadUrl = useAuthStore((s) => s.user?.avatarDownloadUrl);

  return useMutation({
    mutationFn: (file: File) => profileService.uploadAvatar(file),
    onSuccess: (user) => commit(user, previousDownloadUrl),
  });
}

/** Quita el avatar subido. Vuelve al fallback `avatarUrl`/iniciales; refresca el blob. */
export function useDeleteAvatar() {
  const commit = useAvatarMutationCommit();
  const previousDownloadUrl = useAuthStore((s) => s.user?.avatarDownloadUrl);

  return useMutation({
    mutationFn: () => profileService.deleteAvatar(),
    onSuccess: (user) => commit(user, previousDownloadUrl),
  });
}
