import { useWallPresenceContext } from '../context/wall-presence-context';
import type { WallTyper, WallTypingKind } from '../types/wall.types';

/**
 * Hooks de **presencia en tiempo real** del Muro (QL-92 §3.26 + QL-125). Todos leen del **único**
 * socket `/presence` que abre `WallPresenceProvider` (envuelve la ruta `/muro`), así no se abren
 * varios sockets aunque los consuman el header, el composer y el indicador a la vez.
 *
 * **Excepción documentada a "todo dato del servidor por TanStack Query":** conteo en vivo y typers
 * llegan por un **stream WebSocket**, no por HTTP → viven en estado de cliente del provider. Lo
 * único HTTP (el conteo inicial) sí pasa por Query dentro del provider.
 */

export interface WallPresence {
  /** Nº de usuarios en línea (en vivo por WS, con fallback al conteo HTTP inicial). */
  count: number;
  /** `true` mientras no hay ningún conteo aún (ni HTTP inicial ni WS). */
  isLoading: boolean;
  /** `true` cuando el socket está conectado al namespace `/presence`. */
  isConnected: boolean;
}

/** Conteo "· N en línea" (comportamiento idéntico al de antes; ahora lee del socket compartido). */
export function useWallPresence(): WallPresence {
  const { count, isLoading, isConnected } = useWallPresenceContext();
  return { count, isLoading, isConnected };
}

/** Lista de usuarios escribiendo/grabando ahora mismo (QL-125). El server excluye al propio usuario. */
export function useWallTypers(): WallTyper[] {
  return useWallPresenceContext().typers;
}

export interface WallTypingActions {
  /** Marca el propio "escribiendo/grabando" (heartbeat throttled gestionado por el provider). */
  startTyping: (kind: WallTypingKind) => void;
  /** Corta el heartbeat y emite `wall:typing:stop`. */
  stopTyping: () => void;
}

/** Acciones para emitir el propio "escribiendo/grabando" desde el composer (QL-125). */
export function useWallTyping(): WallTypingActions {
  const { startTyping, stopTyping } = useWallPresenceContext();
  return { startTyping, stopTyping };
}
