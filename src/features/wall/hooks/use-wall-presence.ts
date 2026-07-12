import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';

import { useAuthStore } from '@/store/auth.store';

import { wallService } from '../services/wall.service';
import { wallKeys } from './use-wall';
import type { PresenceCountEvent, PresenceErrorEvent } from '../types/wall.types';

/**
 * Presencia en tiempo real del Muro (QL-92, §3.26): el contador de usuarios ÚNICOS conectados
 * ("· N en línea"). Es el **primer y único WebSocket** del proyecto (decisión del cliente D-K3);
 * el resto del tiempo real sigue por polling.
 *
 * **Excepción documentada a "todo dato del servidor por TanStack Query":** el conteo en vivo
 * llega por un **stream WebSocket** (`presence:count`), no por HTTP, así que vive en estado de
 * cliente local del hook (`useState`), igual que el criterio del stream SSE de IA
 * (`ANALISIS_IA_QLEO.md` §"streaming"). Lo único HTTP es el conteo **inicial** (`GET
 * /wall/presence`), que sí pasa por TanStack Query para pintar el primer render sin parpadeo;
 * en cuanto el socket entrega su primer evento, el valor en vivo toma el relevo.
 */

/** Payloads planos del namespace `/presence` (NO llevan el envoltorio HTTP `{ success, data }`). */
const EVENT_COUNT = 'presence:count';
const EVENT_ERROR = 'presence:error';

/**
 * Origen (host+puerto) de la API **sin** el prefijo `/api`: el namespace WS `/presence` cuelga
 * de la raíz del host, no de las rutas HTTP. Deriva de `VITE_QLEO_API_BASE_URL`; si es relativo
 * (p. ej. `/api` en prod tras un proxy), usa el origin de la app.
 */
function resolvePresenceOrigin(): string {
  const base = import.meta.env.VITE_QLEO_API_BASE_URL || '/api';
  const withoutApi = base.replace(/\/api\/?$/, '');
  return /^https?:\/\//i.test(withoutApi) ? withoutApi : window.location.origin;
}

export interface WallPresence {
  /** Nº de usuarios en línea (en vivo por WS, con fallback al conteo HTTP inicial). */
  count: number;
  /** `true` mientras no hay ningún conteo aún (ni HTTP inicial ni WS). */
  isLoading: boolean;
  /** `true` cuando el socket está conectado al namespace `/presence`. */
  isConnected: boolean;
}

/**
 * Abre el socket a `/presence` con el JWT en `auth.token` del handshake, escucha
 * `presence:count` y mantiene el contador en vivo. Reconexión:
 * - Caídas de red → la reconexión automática de socket.io (por defecto) se encarga.
 * - `presence:error` o `io server disconnect` (token inválido/expirado) → socket.io **no**
 *   reconecta solo (es intencional del server); reconectamos a mano leyendo un `accessToken`
 *   fresco del store. El efecto se re-ejecuta al cambiar el token (login/refresh) y limpia
 *   (`socket.disconnect()`) al desmontar para no dejar la presencia "colgada".
 */
export function useWallPresence(): WallPresence {
  const token = useAuthStore((s) => s.accessToken);
  const [liveCount, setLiveCount] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // Conteo inicial HTTP (evita el parpadeo "· 0 en línea" antes del primer evento WS).
  const initial = useQuery({
    queryKey: wallKeys.presence(),
    queryFn: () => wallService.presence(),
    select: (data) => data.count,
    enabled: !!token,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!token) {
      setLiveCount(null);
      setIsConnected(false);
      return;
    }

    let cancelled = false;

    const socket = io(`${resolvePresenceOrigin()}/presence`, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      if (!cancelled) setIsConnected(true);
    });
    socket.on('disconnect', () => {
      if (!cancelled) setIsConnected(false);
    });
    socket.on(EVENT_COUNT, (payload: PresenceCountEvent) => {
      if (!cancelled && typeof payload?.count === 'number') setLiveCount(payload.count);
    });
    // Token inválido/expirado: el server nos desconecta y NO reconecta solo. Reconectamos a
    // mano con el token vigente del store (si el usuario refrescó sesión, el efecto ya se
    // re-montó con el nuevo token; este reintento cubre el caso de un token aún válido).
    socket.on(EVENT_ERROR, (_payload: PresenceErrorEvent) => {
      const fresh = useAuthStore.getState().accessToken;
      if (cancelled || !fresh) return;
      socket.auth = { token: fresh };
      socket.connect();
    });

    return () => {
      cancelled = true;
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  const count = liveCount ?? initial.data ?? 0;
  const isLoading = liveCount == null && initial.isLoading;

  return { count, isLoading, isConnected };
}
