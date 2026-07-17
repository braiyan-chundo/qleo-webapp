import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useAuthStore } from '@/store/auth.store';

import { appVersionService } from '../services/app-version.service';
import { consumePendingUpdate } from '../lib/app-update';

/**
 * Hooks de datos del feature App Version (QL-148, §3.43). Encapsulan TanStack Query para que
 * ningún componente llame al service directamente.
 */

/** Versión del bundle, inyectada por Vite desde `package.json` (`define`, QL-116). Fuente única. */
const APP_VERSION = __APP_VERSION__;

/** Claves de query del feature. */
export const appVersionKeys = {
  check: (version: string) => ['app-version', 'check', version] as const,
};

/**
 * Reporta `__APP_VERSION__` al backend **una vez por carga** con sesión válida (`POST
 * /app-version/check`). Se modela como `useQuery` con `staleTime: Infinity` para que se dispare
 * exactamente una vez por build y quede deduplicado por la caché (nunca en bucle). El fallo es
 * **silencioso** (`retry: false`, no se surfacea en la UI): este heartbeat jamás debe romper nada.
 */
export function useReportAppVersion() {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: appVersionKeys.check(APP_VERSION),
    queryFn: () => appVersionService.check(APP_VERSION),
    enabled: !!token,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

/**
 * Tras la recarga que dispara "Actualizar", muestra el toast "Nueva versión cargada" si el build
 * cargado ya alcanzó la versión objetivo (marca en `sessionStorage`). Corre una sola vez al montar;
 * `consumePendingUpdate` limpia la marca, así que el doble render de StrictMode no lo repite.
 */
export function useAppUpdateToast() {
  useEffect(() => {
    const loadedVersion = consumePendingUpdate(APP_VERSION);
    if (loadedVersion) {
      toast.success('Nueva versión cargada', {
        description: `Ahora usas la versión ${APP_VERSION} de Qleo.`,
      });
    }
  }, []);
}
