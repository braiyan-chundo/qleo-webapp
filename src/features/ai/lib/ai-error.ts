import { ApiError } from '@/core/api/fetch-client';

/**
 * Mensajes legibles por **código** de error de IA (§ códigos de §3.62/§3.63/§3.64). Centralizados
 * para que el chat, las acciones y el gate hablen el mismo idioma. Un código no listado cae al
 * mensaje del backend.
 */
const CODE_MESSAGES: Record<string, string> = {
  AI_ENGINE_UNAVAILABLE:
    'El motor de IA no está disponible ahora. Inténtalo de nuevo en un momento.',
  AI_NOT_AUTHENTICATED:
    'La conexión con ChatGPT caducó. Un administrador debe reconectarla en Configuración.',
  AI_ACCESS_DENIED: 'No tienes acceso al panel de IA. Pídeselo a un administrador.',
  AI_PROVIDER_ERROR: 'El asistente tuvo un problema al responder. Inténtalo de nuevo.',
  AI_ACTION_EXPIRED:
    'La propuesta caducó o ya no está disponible. Vuelve a pedirla en el chat.',
  AI_ACTION_FORBIDDEN: 'No puedes confirmar esta acción.',
  AI_ACTION_IN_PROGRESS: 'La acción ya se está ejecutando. Espera un momento.',
};

const THROTTLE_MESSAGE =
  'Alcanzaste el límite de consultas por hora. Prueba de nuevo más tarde.';

/** Mensaje legible para un `code` de error de IA (evento SSE `error` o similar). */
export function aiCodeMessage(code: string, fallback: string): string {
  return CODE_MESSAGES[code] ?? fallback;
}

/** Traduce cualquier fallo (ApiError o Error) a un mensaje legible para el usuario. */
export function aiErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code && CODE_MESSAGES[err.code]) return CODE_MESSAGES[err.code];
    if (err.status === 429) return THROTTLE_MESSAGE;
    return err.message;
  }
  return err instanceof Error ? err.message : 'Ocurrió un error inesperado.';
}
