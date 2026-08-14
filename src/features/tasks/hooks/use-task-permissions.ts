import { useMyProjectIds } from '@/features/projects/hooks/use-projects';
import { canDiscardTaskIn, hasAtLeastRole, hasPermission } from '@/shared/lib/permissions';
import { useAuthStore } from '@/store/auth.store';

/**
 * (QL-198b, §3.70 §9.1) ¿Puede el usuario en sesión **descartar/restaurar** la tarea de
 * `projectId`?
 *
 * `TASK_DISCARD` es el primer permiso del catálogo con **alcance por proyecto**: habilita el
 * botón, y el proyecto decide dónde se pinta. ADMIN y Dirección lo superan por rol y valen para
 * cualquier tarea.
 *
 * La lista de proyectos **solo se pide a quien la necesita**: si el usuario es Dirección (le vale
 * el rol) o no tiene el permiso (no verá el botón de ninguna manera), no se dispara ninguna
 * petición. Quien sí la necesita paga una sola consulta cacheada y compartida con el resto de la
 * app.
 */
export function useCanDiscardTask(projectId: string | undefined): boolean {
  const user = useAuthStore((s) => s.user);

  const supersededByRole = hasAtLeastRole(user, 'MANAGER');
  const hasDiscardPermission = hasPermission(user, 'TASK_DISCARD');

  const memberProjectIds = useMyProjectIds({
    enabled: !supersededByRole && hasDiscardPermission,
  });

  return canDiscardTaskIn(user, projectId, memberProjectIds);
}
