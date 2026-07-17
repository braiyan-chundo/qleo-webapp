import { useEffect, type ReactNode } from 'react';
import { io } from 'socket.io-client';

import { useAuthStore } from '@/store/auth.store';

import { useRealtimeInvalidation } from '../hooks/use-realtime-invalidation';
import { isRealtimeEvent } from '../types/realtime.types';

/**
 * Provider del **único** socket `/realtime` de la app (QL-133, §3.37). Escucha los cambios que
 * conciernen al usuario y los traduce a invalidaciones de TanStack Query.
 *
 * Va a **nivel de app**, no de ruta, a propósito: el dashboard y "Mis tareas" muestran datos de
 * varios proyectos a la vez, así que el socket no puede colgar de la vista de un proyecto.
 *
 * **Es el segundo socket del proyecto** y no tiene nada que ver con `/presence` (D2): aquel solo
 * vive en `/muro` y su conteo significa "en línea **en el muro**". Se dejan separados.
 *
 * **Degradación**: si el socket no conecta, la app funciona igual — cada hook conserva su poll
 * de red de seguridad (~60 s) y el refetch al reenfocar. El tiempo real es una mejora, no un
 * requisito para que la vista funcione (D9).
 *
 * **Salas**: no se emite `realtime:join` ni `realtime:sync`. El servidor auto-une al usuario a sus
 * proyectos visibles en el handshake y **re-sincroniza solo** al cambiar la membresía o al nacer
 * un proyecto (§3.37); duplicar esa lógica aquí sería reimplementar en el front la autorización
 * que ya hace el backend.
 */

/** Evento del namespace `/realtime`. Payload **plano** (sin el envoltorio HTTP `{ success, data }`). */
const EVENT_CHANGE = 'realtime:event';
const EVENT_ERROR = 'realtime:error';

/**
 * Origen (host+puerto) de la API **sin** el prefijo `/api`: el namespace WS `/realtime` cuelga de
 * la raíz del host, no de las rutas HTTP. Deriva de `VITE_QLEO_API_BASE_URL`; si es relativo
 * (p. ej. `/api` en prod tras un proxy), usa el origin de la app.
 *
 * Misma resolución que `WallPresenceProvider.resolvePresenceOrigin()` (§3.26/§3.37 comparten host).
 */
function resolveRealtimeOrigin(): string {
  const base = import.meta.env.VITE_QLEO_API_BASE_URL || '/api';
  const withoutApi = base.replace(/\/api\/?$/, '');
  return /^https?:\/\//i.test(withoutApi) ? withoutApi : window.location.origin;
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.accessToken);
  const enqueue = useRealtimeInvalidation();

  useEffect(() => {
    // Sin sesión no hay socket (el handshake exige JWT). Al entrar el token, el efecto se
    // re-ejecuta y conecta; al hacer logout, limpia.
    if (!token) return;

    let cancelled = false;

    const socket = io(`${resolveRealtimeOrigin()}/realtime`, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on(EVENT_CHANGE, (payload: unknown) => {
      // Llega de la red: se valida antes de tratarlo como evento (nada de castear a ciegas).
      if (!cancelled && isRealtimeEvent(payload)) enqueue(payload);
    });

    // Token inválido/expirado: el server nos desconecta y NO reconecta solo.
    //
    // A diferencia de `WallPresenceProvider`, solo se reintenta si el token **cambió**: volver a
    // conectar con el MISMO token que el server acaba de rechazar es un bucle de reconexión
    // contra la API. El caso legítimo (el usuario refrescó sesión) ya lo cubre la dependencia
    // `[token]` del efecto, que re-monta el socket con el token nuevo; esta rama solo acorta la
    // carrera de que el error llegue justo entre el refresh y el re-montaje.
    socket.on(EVENT_ERROR, () => {
      const fresh = useAuthStore.getState().accessToken;
      if (cancelled || !fresh || fresh === token) return;
      socket.auth = { token: fresh };
      socket.connect();
    });

    return () => {
      cancelled = true;
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [token, enqueue]);

  return <>{children}</>;
}
