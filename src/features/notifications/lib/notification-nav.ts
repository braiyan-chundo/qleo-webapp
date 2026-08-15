import { tasksService } from '@/features/tasks/services/tasks.service';

import {
  isManagementNotification,
  type Notification,
} from '../services/notifications.service';

/**
 * (QL-200) Dónde vive el panel de rendimiento en ESTA app. El backend manda `/analytics/users`
 * en el `url` del push —su propia ruta de API—, así que la traducción a la ruta del front se
 * hace aquí, en el único sitio que decide destinos.
 */
export const PERFORMANCE_ROUTE = '/analytics';

/**
 * Resuelve la ruta in-app destino de una notificación (§3.10, §3.36). Reglas, **en este orden**:
 * - Con `taskId` → la tarea. Si además viene `projectId` (QL-137: ahora llega en TODAS las notis
 *   de tarea), se construye la ruta **directa** sin pedir nada; si no (noti antigua sin backfill),
 *   se resuelve el proyecto con `tasksService.getById(taskId)`.
 * - **(QL-200)** Alerta de gestión **de persona** (sin `taskId`) → el panel de rendimiento, que es
 *   donde está el estado real y completo. La bandeja es un canal de avisos, no un registro de
 *   incidencias: el aviso coalesce por cooldown, la tabla no.
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
  // (QL-200) Va ANTES del `projectId`: las tres alertas de persona no traen ni tarea ni proyecto,
  // pero si alguna lo trajera algún día, su sitio seguiría siendo el panel de rendimiento.
  if (isManagementNotification(notification.type)) {
    return PERFORMANCE_ROUTE;
  }
  if (notification.projectId) {
    return `/projects/${notification.projectId}`;
  }
  return null;
}
