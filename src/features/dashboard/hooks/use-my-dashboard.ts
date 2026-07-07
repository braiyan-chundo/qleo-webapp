import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/store/auth.store';
import { dashboardService } from '../services/dashboard.service';

/**
 * Hook de datos del dashboard personal (§3.14). Toda la lectura del servidor pasa por
 * TanStack Query (patrón `react-data-fetching`): la página NO llama al service ni maneja
 * loading/error a mano. Refresca por **polling** alineado con el resto del MVP.
 */

/** Claves de query del feature dashboard. Centralizadas para invalidación consistente. */
export const dashboardKeys = {
  all: ['dashboard'] as const,
  me: () => [...dashboardKeys.all, 'me'] as const,
  admin: () => [...dashboardKeys.all, 'admin'] as const,
};

/** Ventana de frescura y polling del panel personal (agregación barata, cambia seguido). */
const STALE_TIME = 30_000;
const REFETCH_INTERVAL = 45_000;

/**
 * Panel personal del usuario autenticado (`GET /dashboard/me`). Solo corre si hay sesión.
 * Expone `data`/`isLoading`/`isError`/`refetch` para pintar loading/empty/error en la UI.
 */
export function useMyDashboard() {
  const token = useAuthStore((s) => s.accessToken);

  return useQuery({
    queryKey: dashboardKeys.me(),
    queryFn: () => dashboardService.getMyDashboard(),
    enabled: !!token,
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
  });
}
