import { createContext, useContext } from 'react';

import type { WallTyper, WallTypingKind } from '../types/wall.types';

/**
 * Contexto de **presencia en tiempo real** del Muro (QL-92 + QL-125): un ÚNICO socket
 * `/presence` compartido por toda la ruta `/muro` (lo abre `WallPresenceProvider`). Expone a la
 * vez el conteo "· N en línea", la lista de quienes escriben/graban, y las acciones para emitir
 * el propio "escribiendo…".
 *
 * **Excepción documentada a "todo dato del servidor por TanStack Query":** conteo y typers llegan
 * por un **stream WebSocket**, no por HTTP, así que viven en estado de cliente del provider (igual
 * criterio que el conteo en vivo original de `useWallPresence`). Lo único HTTP (el conteo inicial)
 * sí pasa por Query dentro del provider.
 */
export interface WallPresenceContextValue {
  /** Nº de usuarios en línea (WS en vivo, con fallback al conteo HTTP inicial). */
  count: number;
  /** `true` mientras no hay ningún conteo aún (ni HTTP inicial ni WS). */
  isLoading: boolean;
  /** `true` cuando el socket está conectado al namespace `/presence`. */
  isConnected: boolean;
  /** Usuarios escribiendo/grabando ahora mismo (el servidor ya excluye al propio usuario). */
  typers: WallTyper[];
  /**
   * Marca "estoy escribiendo/grabando". El heartbeat (~2 s) y su corte por inactividad los
   * gestiona el provider; llamarla repetido mientras se teclea NO abre timers de más.
   */
  startTyping: (kind: WallTypingKind) => void;
  /** Corta el heartbeat y emite `wall:typing:stop`. */
  stopTyping: () => void;
}

export const WallPresenceContext = createContext<WallPresenceContextValue | null>(null);

/** Accede al contexto de presencia; lanza si se usa fuera de `WallPresenceProvider`. */
export function useWallPresenceContext(): WallPresenceContextValue {
  const ctx = useContext(WallPresenceContext);
  if (!ctx) {
    throw new Error('useWallPresenceContext debe usarse dentro de <WallPresenceProvider>.');
  }
  return ctx;
}
