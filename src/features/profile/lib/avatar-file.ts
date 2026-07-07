/**
 * Validación en cliente del avatar antes de subirlo (QL-32, §3.15). Feedback inmediato; el
 * backend sigue siendo la fuente de verdad (revalida 2 MB y el tipo, con `error.code`).
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

/** Mensaje de error de validación local, o `null` si el archivo es válido. */
export function validateAvatarFile(file: File): string | null {
  if (!(AVATAR_ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    return 'Formato no permitido. Usa PNG, JPG, WEBP o GIF.';
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return 'La imagen supera el límite de 2 MB.';
  }
  return null;
}
