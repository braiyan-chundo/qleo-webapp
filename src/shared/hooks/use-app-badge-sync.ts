import { useEffect } from 'react';

import { useUnreadCount } from '@/features/notifications/hooks/use-notifications';
import { useWallUnreadCount } from '@/features/wall/hooks/use-wall';
import { clearAppBadge, setAppBadge } from '@/shared/lib/app-badge';

/**
 * Sincroniza el badge numérico del icono de la app (Badging API) con los no leídos mientras
 * la PWA está abierta (QL-118, §3.17). Es la contraparte "en vivo" del badge que pinta el
 * service worker (`src/sw.ts`) cuando llega un push con la app cerrada.
 *
 * Lugar único y centralizado: se monta en `AppLayout` (siempre presente cuando hay sesión).
 * Reutiliza los conteos que YA sondea la UI por TanStack Query —campana (`useUnreadCount`) y
 * muro (`useWallUnreadCount`)— sin crear queries nuevas (se deduplican por `queryKey`). El
 * badge del icono agrega ambos: cuando el total baja a 0 (el usuario los vio / marcó leído),
 * se limpia; cuando hay novedades, se re-setea con el conteo fresco del polling.
 */
export function useAppBadgeSync(): void {
  const { data: bellUnread = 0 } = useUnreadCount();
  const { count: wallUnread } = useWallUnreadCount();

  const total = bellUnread + wallUnread;

  useEffect(() => {
    if (total > 0) {
      setAppBadge(total);
    } else {
      clearAppBadge();
    }
  }, [total]);
}
