import { ApiError } from '@/core/api/fetch-client';

import type { OpenEndedStatus, Task } from '../services/tasks.service';

/**
 * QL-197 (§3.69) — Presentación y errores de la **fecha de fin abierta**.
 *
 * Una tarea no puede existir sin fecha de inicio, y la de fin solo puede faltar si Dirección lo
 * autoriza. Este módulo concentra las dos cosas que si no se repetirían por media UI: **cómo se
 * pinta** cada estado de la solicitud y **qué se le dice al usuario** ante cada `error.code`.
 *
 * ⚠️ Lo que aquí **no** hay es la regla del bloqueo: el backend la manda ya calculada en
 * `task.openEndedBlocked` y derivarla de `openEndedStatus` es exactamente cómo se desincronizan
 * las dos implementaciones (el fallo de QL-192 con la precedencia de roles). Se usa
 * {@link isOpenEndedBlocked} para leerla, nunca un `status === 'PENDING' || …` a mano.
 */

/** Tono visual de cada estado. `neutral` es deliberado en `APPROVED`: no es un problema. */
type OpenEndedTone = 'pending' | 'rejected' | 'neutral';

export interface OpenEndedPresentation {
  /** Texto del badge en tarjeta y cabecera. Corto: cabe en una card. */
  label: string;
  /** Frase completa para el panel del detalle. */
  description: string;
  /** Clases de token M3 del badge. */
  badgeClass: string;
  tone: OpenEndedTone;
}

/**
 * Cómo se pinta cada estado de la solicitud.
 *
 * `APPROVED` va **sin alarma visual** a propósito: una tarea con fin abierto autorizado es
 * legítima —no genera avisos de vencimiento ni cuenta como vencida—, así que teñirla de rojo o
 * ámbar sería mentir sobre su estado. `PENDING` y `REJECTED` sí avisan, porque la tarea está
 * bloqueada, y llevan colores distintos porque **la salida es distinta**: en `PENDING` hay que
 * esperar; en `REJECTED` ya no hay nada que esperar y toca ponerle fecha.
 */
export const OPEN_ENDED_PRESENTATION: Record<OpenEndedStatus, OpenEndedPresentation> = {
  PENDING: {
    label: 'Esperando autorización',
    description:
      'Esperando autorización de Dirección para dejar la fecha de fin abierta. Mientras tanto la tarea está bloqueada: no se puede mover de columna ni completar.',
    badgeClass: 'bg-warning-container text-on-warning-container',
    tone: 'pending',
  },
  REJECTED: {
    label: 'Fin abierto denegado',
    description:
      'Dirección no autorizó dejar la fecha de fin abierta, así que la tarea sigue bloqueada. Para desbloquearla, ponle una fecha de fin: al hacerlo la solicitud se cancela sola.',
    badgeClass: 'bg-error-container text-on-error-container',
    tone: 'rejected',
  },
  APPROVED: {
    label: 'Sin fecha de fin',
    description:
      'Dirección autorizó dejar la fecha de fin abierta. La tarea funciona con normalidad y no genera avisos de vencimiento.',
    badgeClass: 'bg-surface-container-high text-on-surface-variant',
    tone: 'neutral',
  },
};

/**
 * ¿La tarea está bloqueada por su solicitud de fin abierto? Lee el campo **calculado por el
 * backend**; existe como función solo para que quien la use no tenga que recordar que el campo
 * puede faltar en objetos parciales (una card de un listado antiguo cacheado, p. ej.).
 *
 * Bloqueada = no se puede **mover de columna**, **completar** ni arrancar el cronómetro.
 * Comentar y editar siguen abiertos a propósito: ponerle una fecha de fin es la vía de escape.
 */
export function isOpenEndedBlocked(task: Pick<Task, 'openEndedBlocked'>): boolean {
  return task.openEndedBlocked === true;
}

/**
 * ¿Hay una solicitud pendiente que Dirección pueda resolver? Es la condición —junto con
 * `hasAtLeastRole(user,'MANAGER')`— para ofrecer los botones de autorizar/denegar.
 */
export function isOpenEndedPending(task: Pick<Task, 'openEndedStatus'>): boolean {
  return task.openEndedStatus === 'PENDING';
}

/**
 * QL-197 — Los siete `error.code` de fechas obligatorias y fin abierto. Se responde **al
 * código**, nunca al texto del backend (mismo patrón que `features/users/lib/user-role-errors`).
 *
 * Los dos primeros llegan del alta y de la edición; los cuatro de `OPEN_ENDED_*` del alta y de
 * las acciones bloqueadas; el último, de la resolución.
 */
const TASK_DATE_ERRORS: Record<string, string> = {
  TASK_START_DATE_REQUIRED:
    'La fecha de inicio es obligatoria: puedes cambiarla, pero no dejarla vacía.',
  TASK_DUE_DATE_REQUIRED:
    'La fecha de fin es obligatoria. Si esta tarea no puede tener una, pide autorización a Dirección al crearla.',
  OPEN_ENDED_REQUEST_NOT_APPLICABLE:
    'O pones una fecha de fin, o pides dejarla abierta: no las dos cosas a la vez.',
  OPEN_ENDED_MANAGER_INVALID:
    'La autorización solo se le puede pedir a un usuario activo de Dirección. Elige a otra persona.',
  // Los dos bloqueos llevan códigos distintos porque la salida es distinta: esperar vs. actuar.
  OPEN_ENDED_AUTHORIZATION_PENDING:
    'La tarea está bloqueada hasta que Dirección autorice dejar su fecha de fin abierta.',
  OPEN_ENDED_AUTHORIZATION_REJECTED:
    'Dirección no autorizó el fin abierto: la tarea seguirá bloqueada hasta que le pongas una fecha de fin.',
  // El caso corriente con tres personas en Dirección: dos abren la misma notificación.
  OPEN_ENDED_REQUEST_NOT_PENDING:
    'Esta solicitud ya está resuelta: otra persona de Dirección respondió antes, o el creador le puso fecha de fin.',
};

/**
 * Traduce un fallo de la API a un mensaje accionable si es de fechas/fin abierto. Devuelve
 * `null` cuando el error es de otra cosa, para que el llamador siga con su propia cadena de
 * traducción (miembro del proyecto, etiqueta, rol de solo lectura…).
 */
export function taskDateErrorMessage(err: unknown): string | null {
  if (err instanceof ApiError && err.code && TASK_DATE_ERRORS[err.code]) {
    return TASK_DATE_ERRORS[err.code];
  }
  return null;
}

/** ¿El fallo es el 409 de "ya la resolvió otro"? Merece un tratamiento propio en la UI. */
export function isOpenEndedAlreadyResolved(err: unknown): boolean {
  return err instanceof ApiError && err.code === 'OPEN_ENDED_REQUEST_NOT_PENDING';
}
