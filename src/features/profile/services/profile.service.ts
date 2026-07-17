import { api } from '@/core/api/fetch-client';
import { uploadAvatarRequest } from '@/shared/services/avatar.service';
import type { User } from '@/store/auth.store';

/**
 * Servicio de perfil self-service (QL-26, §3.15). El backend deriva el usuario del token
 * (rutas `users/me`, sin `:id`): un usuario solo consulta/edita SU propio perfil.
 * Devuelve el objeto `User` (sin `passwordHash`).
 */

/** Body de `PATCH /users/me`. Todos opcionales; solo se aplican los que llegan. */
export interface UpdateMePayload {
  name?: string;
  jobTitle?: string;
  avatarUrl?: string;
  /** QL-91: silenciar el push genérico del Muro Corporativo (las menciones siguen llegando). */
  wallPushMuted?: boolean;
  /**
   * QL-153: token de la paleta curada para el primary en modo **claro**. Semántica por campo:
   * ausente = no se toca; string (≤32) = se guarda; `null` = resetea a genérico.
   */
  themePrimaryLight?: string | null;
  /** QL-153: token de la paleta curada para el primary en modo **oscuro**. Misma semántica. */
  themePrimaryDark?: string | null;
}

/** Body de `PATCH /users/me/password`. */
export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export const profileService = {
  /** Perfil del usuario autenticado (`GET /users/me`). */
  getMe: () => api.get<User>('/users/me'),

  /** Actualiza datos básicos del propio perfil (`PATCH /users/me`). */
  updateMe: (data: UpdateMePayload) => api.patch<User>('/users/me', data),

  /**
   * Cambia la contraseña (`PATCH /users/me/password`). Si `currentPassword` no coincide,
   * el backend responde `400 { code: 'INVALID_CURRENT_PASSWORD' }` (capturable vía `ApiError`).
   */
  changePassword: (data: ChangePasswordPayload) =>
    api.patch<User>('/users/me/password', data),

  /**
   * Sube/reemplaza el avatar del propio perfil (`POST /users/me/avatar`, multipart). El
   * multipart no puede pasar por el `api` (fuerza JSON), así que usa el helper compartido
   * con token. Devuelve el `User` actualizado (`avatarDownloadUrl` != null). Errores
   * `FILE_TOO_LARGE` / `UNSUPPORTED_FILE_TYPE` llegan como `ApiError`.
   */
  uploadAvatar: (file: File) => uploadAvatarRequest<User>(file),

  /** Quita el avatar subido (`DELETE /users/me/avatar`). Idempotente. Devuelve el `User`. */
  deleteAvatar: () => api.delete<User>('/users/me/avatar'),
};
