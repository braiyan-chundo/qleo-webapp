import { QueryClient } from '@tanstack/react-query';

/**
 * Cliente único de TanStack Query para toda la app.
 *
 * Defaults pensados para Qleo:
 * - `staleTime` de 30s: evita refetches agresivos en navegación normal.
 * - `retry` 1: un reintento; los 401 los maneja el fetch-client (logout global),
 *   así que no tiene sentido reintentarlos muchas veces.
 * - `refetchOnWindowFocus` false: en un panel de trabajo el refetch al enfocar
 *   la ventana molesta; se refresca vía invalidación explícita tras mutaciones.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
