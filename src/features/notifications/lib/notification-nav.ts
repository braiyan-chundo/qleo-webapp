import { tasksService } from '@/features/tasks/services/tasks.service';

import type { Notification } from '../services/notifications.service';

/**
 * Resuelve la ruta in-app destino de una notificación (§3.10, §3.36). Reglas, **en este orden**:
 * - Con `taskId` → la tarea. Si además viene `projectId` (QL-137: ahora llega en TODAS las notis
 *   de tarea), se construye la ruta **directa** sin pedir nada; si no (noti antigua sin backfill),
 *   se resuelve el proyecto con `tasksService.getById(taskId)`.
 * - Sin `taskId` pero con `projectId` (p. ej. `PROJECT_MEMBER_ADDED`) → el proyecto.
 * - Sin ninguno (p. ej. `WALL_MENTION`) → `null`: no hay tarea/proyecto que abrir desde aquí.
 *
 * ⚠️ El orden importa y NO es cosmético (QL-137). Antes se miraba `projectId` primero, cuando era
 * exclusivo de `PROJECT_MEMBER_ADDED`. Tras el backfill de §3.36 **todas** las notis de tarea
 * traen `projectId`, así que ese orden mandaba una `MENTION`/`TASK_ASSIGNED`/`TASK_MOVED` al
 * tablero del proyecto en vez de a la tarea. `taskId` primero es lo que distingue una noti de
 * tarea de una de proyecto.
 *
 * Puede lanzar si la tarea no se resuelve (borrada / sin acceso); el llamador lo captura para
 * avisar sin romper el marcado de leída.
 */
export async function resolveNotificationHref(
  notification: Notification,
): Promise<string | null> {
  if (notification.taskId) {
    // Camino rápido (QL-137): el proyecto ya viene en la noti → cero peticiones.
    if (notification.projectId) {
      return `/projects/${notification.projectId}/tasks/${notification.taskId}`;
    }
    const task = await tasksService.getById(notification.taskId);
    return `/projects/${task.projectId}/tasks/${notification.taskId}`;
  }
  if (notification.projectId) {
    return `/projects/${notification.projectId}`;
  }
  return null;
}
