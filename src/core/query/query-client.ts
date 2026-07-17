import { QueryClient } from '@tanstack/react-query';

/**
 * (QL-133, D9) **Red de seguridad** de sondeo de las vistas que el bus `/realtime` refresca.
 *
 * El bus invalida al instante, así que el polling ya no es el mecanismo de refresco: es el
 * plan B. Pero **no se quita**, se baja. Sin poll, un evento que no llegue (socket caído, un
 * endpoint que se olvide de difundir) pasa de "latencia de 15 s" a "no se entera nunca": un
 * fallo **silencioso**, peor que el bug que QL-133 arregla. Cuando el bus lleve tiempo en
 * producción se decide si se quitan.
 *
 * Ojo: esto es para queries **dirigidas por eventos**. Una query cuyo valor avanza con el reloj
 * (el `workedMs` de una tarea en curso) no tiene evento que la despierte y conserva su cadencia
 * propia — no la migres a esta constante.
 */
export const SAFETY_NET_POLL_MS = 60_000;

/**
 * Cliente único de TanStack Query para toda la app.
 *
 * Defaults pensados para Qleo:
 * - `staleTime` de 30s: evita refetches agresivos en navegación normal.
 * - `retry` 1: un reintento; los 401 los maneja el fetch-client (logout global),
 *   así que no tiene sentido reintentarlos muchas veces.
 * - `refetchOnWindowFocus` **true** (QL-133): volver a la pestaña re-pide lo que esté obsoleto.
 *   Antes era `false`, y era una de las tres causas del "me toca salir y entrar para que
 *   actualice": sin él, el único disparador de refresco era re-montar el componente. Con
 *   `staleTime` de 30 s el coste está acotado (enfocar dos veces seguidas no re-pide nada).
 *   Las cachés que se gestionan a mano (el feed del muro) lo desactivan **explícitamente**
 *   en su propio hook; no las arrastra este default.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 0,
    },
  },
});
