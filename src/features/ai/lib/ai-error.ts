import { ApiError } from '@/core/api/fetch-client';

/**
 * Mensajes legibles por **código** de error de IA (§ códigos de §3.62/§3.63/§3.64/§3.67).
 * Centralizados para que el chat, las acciones, el gate y el selector de modelo hablen el mismo
 * idioma. Un código no listado cae al mensaje del backend.
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
  // QL-194 — modelo de IA (§3.67).
  AI_MODEL_UNKNOWN:
    'Ese modelo no está en el listado. Elige uno de la lista o añádelo primero.',
  AI_MODEL_ALREADY_LISTED: 'Ese modelo ya está en el listado; búscalo más abajo.',
  AI_MODEL_NOT_LISTED:
    'Ese modelo no se puede quitar: lo publica el motor de IA, no lo añadió un administrador.',
  AI_MODEL_IN_USE:
    'No puedes quitar el modelo que está activo. Elige primero otro modelo (o "Automático") y vuelve a intentarlo.',
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
