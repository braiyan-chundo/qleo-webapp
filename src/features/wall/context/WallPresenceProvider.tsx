import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';

import { useAuthStore } from '@/store/auth.store';

import { wallService } from '../services/wall.service';
import { wallKeys } from '../hooks/use-wall';
import type {
  PresenceCountEvent,
  PresenceErrorEvent,
  WallTyper,
  WallTypingEvent,
  WallTypingKind,
  WallTypingSignal,
} from '../types/wall.types';
import { WallPresenceContext, type WallPresenceContextValue } from './wall-presence-context';

/**
 * Provider del **único** socket `/presence` del Muro (QL-92 + QL-125). Antes cada `useWallPresence`
 * abría su propio socket; ahora hay **exactamente uno** por la ruta `/muro`, compartido vía contexto,
 * que atiende a la vez:
 * - `presence:count` → conteo "· N en línea" (comportamiento idéntico al de antes).
 * - `wall:typing` (server→cliente) → lista de quienes escriben/graban.
 * - emisiones `wall:typing` / `wall:typing:stop` (cliente→servidor) con **heartbeat throttled**.
 *
 * Reconexión: caídas de red → reconexión automática de socket.io; `presence:error` /
 * `io server disconnect` (token inválido) → reconexión manual con un token fresco del store.
 * El efecto se re-ejecuta al cambiar el token (login/refresh) y limpia al desmontar.
 */

/** Payloads planos del namespace `/presence` (NO llevan el envoltorio HTTP `{ success, data }`). */
const EVENT_COUNT = 'presence:count';
const EVENT_ERROR = 'presence:error';
const EVENT_TYPING = 'wall:typing';
const EVENT_TYPING_STOP = 'wall:typing:stop';

/** Cadencia del heartbeat de "escribiendo…" (cliente→servidor) mientras hay actividad. */
const TYPING_HEARTBEAT_MS = 2000;
/** Sin nuevas pulsaciones en este margen (kind `'text'`) ⇒ auto-stop del heartbeat. */
const TYPING_IDLE_MS = 4000;

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

export function WallPresenceProvider({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.accessToken);
  const [liveCount, setLiveCount] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [typers, setTypers] = useState<WallTyper[]>([]);
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

  // ----- Emisor propio de "escribiendo/grabando…" con heartbeat throttled -----
  // `activeRef`: hay una sesión de typing en curso; `kindRef`: su modo actual (text/audio).
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const idleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(false);
  const kindRef = useRef<WallTypingKind | null>(null);

  const clearTypingTimers = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (idleRef.current) {
      clearTimeout(idleRef.current);
      idleRef.current = null;
    }
  }, []);

  const stopTyping = useCallback(() => {
    clearTypingTimers();
    if (!activeRef.current) return; // nada en curso → no spamear `stop` (p. ej. blur en vacío).
    activeRef.current = false;
    kindRef.current = null;
    socketRef.current?.emit(EVENT_TYPING_STOP);
  }, [clearTypingTimers]);

  const startTyping = useCallback(
    (kind: WallTypingKind) => {
      const kindChanged = kindRef.current !== kind;
      kindRef.current = kind;

      if (!activeRef.current) {
        // Arranca la sesión: emite ya y programa el heartbeat (un solo intervalo).
        activeRef.current = true;
        socketRef.current?.emit(EVENT_TYPING, { kind } satisfies WallTypingSignal);
        heartbeatRef.current = setInterval(() => {
          const current = kindRef.current;
          if (current) {
            socketRef.current?.emit(EVENT_TYPING, { kind: current } satisfies WallTypingSignal);
          }
        }, TYPING_HEARTBEAT_MS);
      } else if (kindChanged) {
        // Cambió texto↔audio dentro de la misma sesión → refleja el nuevo modo al instante.
        socketRef.current?.emit(EVENT_TYPING, { kind } satisfies WallTypingSignal);
      }

      // Auto-stop por inactividad SOLO para texto; la grabación tiene stop explícito del composer.
      if (idleRef.current) {
        clearTimeout(idleRef.current);
        idleRef.current = null;
      }
      if (kind === 'text') {
        idleRef.current = setTimeout(stopTyping, TYPING_IDLE_MS);
      }
    },
    [stopTyping],
  );

  // Al desmontar el provider (salir de `/muro`) corta cualquier timer de typing pendiente.
  useEffect(() => clearTypingTimers, [clearTypingTimers]);

  // ----- Socket único /presence: conteo en vivo + lista de "escribiendo…" -----
  useEffect(() => {
    if (!token) {
      setLiveCount(null);
      setIsConnected(false);
      setTypers([]);
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
      if (cancelled) return;
      setIsConnected(false);
      setTypers([]); // sin conexión la lista local queda obsoleta; el server la re-emite al volver.
    });
    socket.on(EVENT_COUNT, (payload: PresenceCountEvent) => {
      if (!cancelled && typeof payload?.count === 'number') setLiveCount(payload.count);
    });
    socket.on(EVENT_TYPING, (payload: WallTypingEvent) => {
      if (!cancelled) setTypers(Array.isArray(payload?.typers) ? payload.typers : []);
    });
    // Token inválido/expirado: el server nos desconecta y NO reconecta solo. Reintenta con el
    // token vigente del store (si el usuario refrescó sesión el efecto ya se re-montó con el nuevo).
    socket.on(EVENT_ERROR, (_payload: PresenceErrorEvent) => {
      const fresh = useAuthStore.getState().accessToken;
      if (cancelled || !fresh) return;
      socket.auth = { token: fresh };
      socket.connect();
    });

    return () => {
      cancelled = true;
      clearTypingTimers();
      activeRef.current = false;
      kindRef.current = null;
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, clearTypingTimers]);

  const count = liveCount ?? initial.data ?? 0;
  const isLoading = liveCount == null && initial.isLoading;

  const value = useMemo<WallPresenceContextValue>(
    () => ({ count, isLoading, isConnected, typers, startTyping, stopTyping }),
    [count, isLoading, isConnected, typers, startTyping, stopTyping],
  );

  return <WallPresenceContext.Provider value={value}>{children}</WallPresenceContext.Provider>;
}
