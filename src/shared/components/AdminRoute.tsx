import { Navigate, Outlet } from 'react-router-dom';

import {
  hasAtLeastRole,
  hasPermission,
  type PlatformPermission,
} from '@/shared/lib/permissions';
import { useAuthStore } from '@/store/auth.store';

interface AdminRouteProps {
  /**
   * (QL-198b, §3.70 §9) Permiso que **también** abre la ruta, sin exigir rol. Sirve para que un
   * permiso delegable no acabe siendo un permiso que miente: `LABEL_MANAGE` habilita curar el
   * catálogo de etiquetas, que vive en `/admin/configuracion`; sin esto se podría conceder y no
   * habría forma de usarlo.
   *
   * La página de destino sigue siendo responsable de enseñar **solo** lo que ese permiso cubre
   * (`AdminSettingsPage` filtra sus tabs), y el backend de rechazar el resto.
   */
  allowWithPermission?: PlatformPermission;
}

/**
 * Guard del **área de administración**. Exige **ADMIN o Dirección** (QL-195) o, si se declara,
 * el permiso de `allowWithPermission` (QL-198b); en caso contrario redirige al inicio. Debe
 * anidarse DENTRO del área ya autenticada (`SessionGate` garantiza que `user` está rehidratado
 * antes de evaluar el rol).
 *
 * El nombre se mantiene (`AdminRoute`, `adminOnly` en `shared/config/nav.ts`) porque marca el
 * área de administración, que desde QL-195 comparten los dos roles: ninguna ruta del backend es
 * ya exclusiva de ADMIN salvo las tres acciones de conexión de IA, que se gatean dentro de su
 * propio componente y no por ruta.
 */
export function AdminRoute({ allowWithPermission }: AdminRouteProps = {}) {
  const user = useAuthStore((s) => s.user);

  const allowed =
    hasAtLeastRole(user, 'MANAGER') ||
    (!!allowWithPermission && hasPermission(user, allowWithPermission));

  if (!allowed) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
