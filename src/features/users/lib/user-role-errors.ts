import { ApiError } from '@/core/api/fetch-client';

/**
 * QL-195 (§3.67) — Los tres 403 **anti-escalada** que puede devolver la gestión de usuarios
 * desde que `POST /users` y `PATCH /users/:id` dejaron de ser exclusivos de ADMIN.
 *
 * La UI intenta que **no lleguen a verse** (el selector esconde `ADMIN` a Dirección, las filas
 * de un ADMIN salen deshabilitadas, el propio rol no se puede tocar). Esto es la red de abajo:
 * el backend es la autoridad y puede rechazar algo que la UI creía permitido —una sesión con el
 * rol cacheado en `localStorage`, dos pestañas abiertas, un usuario promovido mientras tanto—.
 *
 * Se responde al **`code`**, nunca al texto del mensaje.
 */
const USER_ROLE_ERRORS: Record<string, string> = {
  ROLE_ESCALATION_FORBIDDEN:
    'No puedes asignar un rol superior al tuyo. Solicítalo a un Administrador del sistema.',
  CANNOT_MANAGE_ADMIN:
    'No puedes modificar ni desactivar a un usuario Administrador del sistema.',
  // Explica el porqué en vez de soltar un "prohibido" seco: nadie se cambia el rol a sí mismo
  // (ni un ADMIN), para que la promoción sea siempre una decisión de otra persona.
  CANNOT_CHANGE_OWN_ROLE:
    'Nadie puede cambiar su propio rol, ni un Administrador: tiene que hacerlo otra persona. Pídeselo a un Administrador del sistema.',
};

/**
 * Traduce un fallo de la API a un mensaje accionable, dando prioridad a los códigos de rol de
 * QL-195. Si el error es de otra cosa, devuelve `null` para que el llamador siga con su propia
 * cadena de traducción (email duplicado, fecha de nacimiento…).
 */
export function userRoleErrorMessage(err: unknown): string | null {
  if (err instanceof ApiError && err.code && USER_ROLE_ERRORS[err.code]) {
    return USER_ROLE_ERRORS[err.code];
  }
  return null;
}
