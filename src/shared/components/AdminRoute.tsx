import { Navigate, Outlet } from 'react-router-dom';

import { hasAtLeastRole } from '@/shared/lib/permissions';
import { useAuthStore } from '@/store/auth.store';

/**
 * Guard por rol de plataforma. Exige **ADMIN o Dirección** (QL-195); en caso contrario
 * redirige al inicio. Debe anidarse DENTRO del área ya autenticada (`SessionGate` garantiza
 * que `user` está rehidratado antes de evaluar el rol).
 *
 * El nombre se mantiene (`AdminRoute`, `adminOnly` en `shared/config/nav.ts`) porque marca el
 * **área de administración**, que desde QL-195 comparten los dos roles: ninguna ruta del
 * backend es ya exclusiva de ADMIN salvo las tres acciones de conexión de IA, que se gatean
 * dentro de su propio componente y no por ruta.
 */
export function AdminRoute() {
  const user = useAuthStore((s) => s.user);

  if (!hasAtLeastRole(user, 'MANAGER')) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
