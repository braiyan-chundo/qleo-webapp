import { ApiError } from '@/core/api/fetch-client';

/**
 * Lectura de los errores de recordatorios (§3.74 §3). Se decide por `error.code`, nunca por el
 * texto. Los textos son los de la vista de diseño (`hu/design/HU-0202.md` › Textos).
 */

export type ReminderErrorCode =
  | 'REMINDER_SCHEDULE_INVALID'
  | 'REMINDER_IN_PAST'
  | 'REMINDER_NOT_FOUND'
  | 'REMINDER_TASK_NOT_FOUND'
  | 'REMINDER_LIMIT_REACHED'
  | 'REMINDER_FINISHED'
  | 'REMINDER_CONFLICT';

/** Sin red, `fetch` rechaza con `TypeError` antes de que haya respuesta (D-19). */
export function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError || (typeof navigator !== 'undefined' && navigator.onLine === false);
}

export function reminderErrorCode(error: unknown): string | null {
  return error instanceof ApiError ? error.code : null;
}

export const REMINDER_ERROR_TEXT = {
  offlineSave: 'Sin conexión. No se guardó nada: revisa tu red y vuelve a intentarlo.',
  offlineChange: 'Sin conexión. No se guardó el cambio: revisa tu red y vuelve a intentarlo.',
  offlineChangeDetail: 'Tus avisos ya programados suenan igual.',
  limitReached:
    'Llegaste al tope de 100 recordatorios. Elimina los que ya no necesites —por ejemplo, los cumplidos— para crear otro.',
  taskNotFound:
    'Esa tarea ya no existe o no tienes acceso. Elige otra o deja el recordatorio sin tarea.',
  notFound: 'Este recordatorio ya no existe.',
  finished: 'Este recordatorio ya se cumplió. Edítalo con una fecha futura para volver a activarlo.',
  conflict: 'El recordatorio cambió mientras tanto. Revisa los datos y vuelve a intentarlo.',
  scheduleInvalid: 'Revisa la programación: algún dato no es válido.',
  genericSave: 'No se pudo guardar el recordatorio. Vuelve a intentarlo.',
  genericChange: 'No se pudo guardar el cambio. Vuelve a intentarlo.',
  genericDelete: 'No se pudo eliminar el recordatorio. Vuelve a intentarlo.',
} as const;
