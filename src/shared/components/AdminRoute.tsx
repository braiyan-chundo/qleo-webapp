import { Navigate, Outlet } from 'react-router-dom';

import { useAuthStore } from '@/store/auth.store';

/**
 * Guard por rol de plataforma. Exige `role === 'ADMIN'`; en caso contrario redirige al
 * inicio. Debe anidarse DENTRO del área ya autenticada (`SessionGate` garantiza que
 * `user` está rehidratado antes de evaluar el rol).
 */
export function AdminRoute() {
  const user = useAuthStore((s) => s.user);

  if (user?.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
