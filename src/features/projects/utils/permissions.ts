import type { User } from '@/store/auth.store';
import type { Project } from '../types/project';

/**
 * Forma mínima de proyecto que necesitan estas reglas. Se pide solo lo que se usa (y no el
 * `Project` entero) para que también sirvan a los componentes que reciben una proyección
 * parcial, como `ProjectDocumentsPanel`.
 */
type ProjectPermissionFields = Pick<Project, 'createdBy' | 'managerIds'>;

/**
 * Reglas de permiso **sobre un proyecto** (P2/§3.20). Espejan los `assert*` del backend, que
 * es la autoridad real: la UI solo decide qué mostrar, el backend responde 403 igualmente.
 *
 * Viven aquí (y no en `@/shared/lib/permissions`, que es solo permiso de *plataforma*) porque
 * dependen del tipo `Project` del feature. Son la **única fuente** de estas reglas en el front:
 * recalcular la expresión a mano en cada consumidor es justo lo que las desincroniza (QL-63:
 * el botón de "Configurar tablero" admitía gestores y el diálogo que abría, no).
 */

/**
 * ¿El usuario puede **gestionar** el proyecto? → editar, archivar, configurar el tablero
 * (etapas/columnas/plantilla) y subir documentos de proyecto.
 *
 * Autoriza a `ADMIN`, al **creador** y a un miembro con **permiso de gestión otorgado**
 * (`managerIds`). Espeja `ProjectsService.assertCanManageProject` del backend (y su gemelo
 * en `ColumnsService`, que reserva las columnas y la plantilla a esos mismos tres).
 *
 * Ojo: NO habilita gestionar la membresía ni otorgar/revocar gestores → `canManageMembership`.
 */
export function canManageProject(
  project: ProjectPermissionFields | null | undefined,
  user: User | null | undefined,
): boolean {
  if (!project || !user) return false;
  return (
    user.role === 'ADMIN' ||
    project.createdBy === user.id ||
    project.managerIds.includes(user.id)
  );
}

/**
 * ¿El usuario puede gestionar la **membresía y los permisos** del proyecto? → añadir/quitar
 * miembros y otorgar/revocar el permiso de gestión.
 *
 * Más estricta que `canManageProject`: solo `ADMIN` o el **creador**. Un gestor otorgado puede
 * configurar el proyecto pero no repartir permisos. Espeja `assertCanManageMembership`.
 */
export function canManageMembership(
  project: Pick<Project, 'createdBy'> | null | undefined,
  user: User | null | undefined,
): boolean {
  if (!project || !user) return false;
  return user.role === 'ADMIN' || project.createdBy === user.id;
}
