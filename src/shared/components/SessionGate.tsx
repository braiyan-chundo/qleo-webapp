import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { QleoLoader } from '@/shared/components/QleoLoader';
import { useProfile } from '@/features/auth/hooks/use-auth';
import { ApiError } from '@/core/api/fetch-client';
import { useAuthStore } from '@/store/auth.store';

/**
 * Gate de arranque del área autenticada. Con un token guardado, valida/rehidrata la
 * sesión contra `GET /auth/me` ANTES de renderizar el contenido protegido:
 *
 * - Sin token → redirige a `/login`.
 * - Con token, mientras el perfil no ha resuelto → estado de carga a pantalla completa.
 * - Token inválido/expirado (401) → `logout()` + redirige a `/login` (evita que un
 *   token muerto pase el guard y luego revienten todas las llamadas).
 * - Otro error → estado de error con reintentar / cerrar sesión.
 * - OK → renderiza el área protegida (`<Outlet />`).
 */
export function SessionGate() {
  const token = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const location = useLocation();

  const { isLoading, isError, error, refetch } = useProfile();

  const is401 = error instanceof ApiError && error.status === 401;

  // Token inválido/expirado: limpiamos la sesión. La redirección a /login la resuelve
  // el `return <Navigate>` de abajo al quedar sin token.
  useEffect(() => {
    if (is401) logout();
  }, [is401, logout]);

  if (!token) {
    // Guardamos la ubicación actual para volver aquí tras el login (QL-49).
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // El perfil aún no ha resuelto y no tenemos usuario rehidratado todavía.
  if (isLoading && !user) {
    return <QleoLoader fullPage label="Cargando tu sesión…" />;
  }

  // Fallo de red u otro error (no 401): permitimos reintentar o cerrar sesión.
  if (isError && !is401) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface px-6 text-center">
        <div className="max-w-sm space-y-2">
          <h1 className="text-lg font-semibold text-on-surface">
            No se pudo verificar tu sesión
          </h1>
          <p className="text-sm text-on-surface-variant">
            {error instanceof Error
              ? error.message
              : 'Revisa tu conexión e inténtalo de nuevo.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => logout()}>
            Cerrar sesión
          </Button>
          <Button onClick={() => refetch()}>Reintentar</Button>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
