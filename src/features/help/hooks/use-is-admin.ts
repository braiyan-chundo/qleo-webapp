import { hasAtLeastRole } from '@/shared/lib/permissions';
import { useAuthStore } from '@/store/auth.store';

/**
 * ¿El usuario en sesión pertenece al **área de administración** de la plataforma? (QL-128)
 *
 * (QL-195) Desde que existe Dirección, esto es `hasAtLeastRole(user,'MANAGER')`: vale `true`
 * para ADMIN **y** para MANAGER. El nombre del hook se mantiene porque lo consumen las
 * primitivas por su flag `adminOnly`; lo que devuelve es "administra la plataforma", no "es
 * exactamente ADMIN".
 *
 * Única lectura del rol en la Ayuda: las primitivas (`Section`, `FeatureList`, `ConceptGrid`,
 * `AdminOnly`) y `HelpPage` la usan para ocultar a un MEMBER la documentación de lo que no
 * puede hacer, y para marcar con el badge «Administración y Dirección» lo que no es suyo.
 *
 * **Ojo:** el rol de PLATAFORMA (`ADMIN`/`MANAGER`/`MEMBER`) no tiene nada que ver con los 4
 * roles POR TAREA (Creador/Responsable/Colaborador/Observador) que documenta `RolesSection`, ni
 * con los permisos POR PROYECTO (creador/gestor). Son tres niveles distintos.
 */
export function useIsAdmin(): boolean {
  const user = useAuthStore((s) => s.user);
  return hasAtLeastRole(user, 'MANAGER');
}
