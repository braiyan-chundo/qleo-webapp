import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/store/auth.store';
import { dashboardService } from '../services/dashboard.service';
import { dashboardKeys } from './use-my-dashboard';

/**
 * Hook de datos del dashboard ADMIN (§3.14). Toda la lectura del servidor pasa por
 * TanStack Query (patrón `react-data-fetching`): el componente NO llama al service ni
 * maneja loading/error a mano. Refresca por **polling** como el panel personal.
 */

/** Ventana de frescura y polling del panel ADMIN (misma cadencia que el personal). */
const STALE_TIME = 30_000;
const REFETCH_INTERVAL = 45_000;

/**
 * Panel de administración (`GET /dashboard/admin`). Solo corre si hay sesión **y** el
 * usuario es ADMIN — el backend igual lo protege con 403, pero evitamos la llamada para
 * un MEMBER. Expone `data`/`isLoading`/`isError`/`refetch` para pintar loading/error/UI.
 */
export function useAdminDashboard() {
  const token = useAuthStore((s) => s.accessToken);
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');

  return useQuery({
    queryKey: dashboardKeys.admin(),
    queryFn: () => dashboardService.getAdminDashboard(),
    enabled: !!token && isAdmin,
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
  });
}
