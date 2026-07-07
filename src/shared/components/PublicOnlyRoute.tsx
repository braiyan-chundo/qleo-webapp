import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuthStore } from '@/store/auth.store';
import { getFromPath } from '@/shared/lib/router-state';

/**
 * Guard de rutas públicas (QL-49). Complemento de `SessionGate`: si ya hay sesión activa
 * (`accessToken` **y** `user` en el store), impide entrar a `/login` y redirige a la ruta
 * previa (`state.from`, colocada por `SessionGate`) o al inicio. Si no hay sesión, renderiza
 * la rama pública (`<Outlet />`).
 */
export function PublicOnlyRoute() {
  const token = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (token && user) {
    const to = getFromPath(location.state) ?? '/';
    return <Navigate to={to} replace />;
  }

  return <Outlet />;
}
