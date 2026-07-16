import { useAuthStore } from '@/store/auth.store';

/**
 * ¿El usuario en sesión es ADMIN **de plataforma**? (QL-128)
 *
 * Única lectura del rol en la Ayuda: las primitivas (`Section`, `FeatureList`,
 * `ConceptGrid`, `AdminOnly`) y `HelpPage` la usan para ocultar a un MEMBER la
 * documentación de lo que no puede hacer, y para marcar con el badge «Solo
 * administradores» lo que sí es exclusivo del ADMIN.
 *
 * **Ojo:** el rol de PLATAFORMA (`ADMIN`/`MEMBER`) no tiene nada que ver con los 4 roles
 * POR TAREA (Creador/Responsable/Colaborador/Observador) que documenta `RolesSection`, ni
 * con los permisos POR PROYECTO (creador/gestor). Son tres niveles distintos.
 */
export function useIsAdmin(): boolean {
  return useAuthStore((s) => s.user?.role === 'ADMIN');
}
