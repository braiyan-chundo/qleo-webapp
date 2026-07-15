import { tasksService } from '@/features/tasks/services/tasks.service';

import type { Notification } from '../services/notifications.service';

/**
 * Resuelve la ruta in-app destino de una notificación (§3.10). Reglas:
 * - `PROJECT_MEMBER_ADDED` trae `projectId` (y `taskId=null`) → `/projects/{projectId}` directo,
 *   sin resolver nada.
 * - Notis de tarea (`taskId` presente, sin `projectId`) → la ruta real es
 *   `/projects/:projectId/tasks/:taskId`, así que se resuelve el proyecto con
 *   `tasksService.getById(taskId)` (mismo patrón que ya usaba la campana con `MENTION`).
 * - Sin `taskId` ni `projectId` (p. ej. `WALL_MENTION`) → `null`: no hay ruta de tarea/proyecto
 *   que abrir desde aquí.
 *
 * Puede lanzar si la tarea no se resuelve (borrada / sin acceso); el llamador lo captura para
 * avisar sin romper el marcado de leída.
 */
export async function resolveNotificationHref(
  notification: Notification,
): Promise<string | null> {
  if (notification.projectId) {
    return `/projects/${notification.projectId}`;
  }
  if (notification.taskId) {
    const task = await tasksService.getById(notification.taskId);
    return `/projects/${task.projectId}/tasks/${notification.taskId}`;
  }
  return null;
}
