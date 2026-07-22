import { ApiError } from '@/core/api/fetch-client';

import { compressImageFile } from './compress-image';

/**
 * Preparación y validación en cliente de una imagen de avatar antes de subirla (QL-32, §3.15).
 * Feedback inmediato; el backend sigue siendo la fuente de verdad (revalida 2 MB y el tipo, con
 * `error.code`).
 *
 * (QL-181) Vive en `shared/lib` porque los límites son **idénticos** en los dos sitios que
 * suben imágenes de avatar: la foto de perfil (`POST /users/me/avatar`) y el catálogo global
 * (`POST /avatars`, §3.59).
 */

/** Tipos MIME de imagen permitidos por el backend. */
export const AVATAR_ACCEPTED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
] as const;

/** Atributo `accept` del `<input type="file">`. */
export const AVATAR_ACCEPT_ATTR = AVATAR_ACCEPTED_TYPES.join(',');

/** Tamaño máximo del avatar en bytes (2 MB). */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

/** Mensaje de error si el MIME no está en la whitelist, o `null`. */
export function validateAvatarType(file: File): string | null {
  if (!(AVATAR_ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    return 'Formato no permitido. Usa PNG, JPG, WEBP o GIF.';
  }
  return null;
}

/** Mensaje de error si el archivo supera el límite del backend, o `null`. */
export function validateAvatarSize(file: File): string | null {
  if (file.size > AVATAR_MAX_BYTES) {
    return 'La imagen supera el límite de 2 MB.';
  }
  return null;
}

/** Mensaje de error de validación local (tipo + tamaño), o `null` si el archivo es válido. */
export function validateAvatarFile(file: File): string | null {
  return validateAvatarType(file) ?? validateAvatarSize(file);
}

/**
 * (QL-181) Deja el archivo listo para enviar: valida el **tipo**, lo **comprime** (recorte
 * centrado 256×256 → WebP) y solo entonces valida el **tamaño**.
 *
 * El orden importa: comprimir antes de medir hace que una foto de 6 MB del móvil pase sin
 * problema, y el tope de 2 MB solo llega a saltar en lo que no se puede comprimir (un GIF
 * animado, o un navegador sin WebP en `canvas`, donde `compressImageFile` devuelve el original).
 *
 * Lanza `Error` con el mensaje ya listo para el toast; se usa dentro del `mutationFn` para que
 * ningún llamador pueda saltarse la compresión por olvido.
 */
export async function prepareAvatarUpload(file: File): Promise<File> {
  const typeError = validateAvatarType(file);
  if (typeError) throw new Error(typeError);

  const prepared = await compressImageFile(file);

  const sizeError = validateAvatarSize(prepared);
  if (sizeError) throw new Error(sizeError);

  return prepared;
}

/**
 * Traduce un fallo de subida/gestión de avatar a un mensaje para el usuario. Reacciona al
 * **`error.code`** (§3.15/§3.59), nunca al texto del backend. Compartido por la foto de perfil
 * y por el catálogo global, que tienen los mismos límites y los mismos códigos.
 */
export function avatarErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'FILE_TOO_LARGE':
        return 'La imagen supera el límite de 2 MB.';
      case 'UNSUPPORTED_FILE_TYPE':
        return 'Formato no permitido. Usa PNG, JPG, WEBP o GIF.';
      case 'AVATAR_NOT_FOUND':
        return 'Ese avatar ya no está en el catálogo.';
    }
    return err.message;
  }
  return err instanceof Error ? err.message : fallback;
}
