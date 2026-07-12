import { useCallback, useLayoutEffect, useRef } from 'react';

import type { WallFeedItem } from '../lib/wall-feed';

interface UseWallScrollArgs {
  messages: WallFeedItem[];
  hasMoreOlder: boolean;
  isLoadingOlder: boolean;
  loadOlder: () => void;
}

/** Distancia (px) al fondo para considerar que el usuario "está abajo" y auto-seguir. */
const NEAR_BOTTOM = 80;
/** Distancia (px) al tope para disparar la carga de historial. */
const NEAR_TOP = 80;

/**
 * Lógica de scroll del muro tipo chat (recientes abajo):
 * - **Primera carga** y **envío** → baja al fondo.
 * - **Mensaje nuevo** (polling/optimista) → sigue al fondo **solo si** el usuario ya estaba
 *   abajo (no interrumpe si subió a leer historial).
 * - **Historial** (prepend por `before`) → preserva la posición visual (sin salto).
 * - Al acercarse al tope → pide más historial.
 */
export function useWallScroll({
  messages,
  hasMoreOlder,
  isLoadingOlder,
  loadOlder,
}: UseWallScrollArgs) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const didInitRef = useRef(false);
  const prevRef = useRef<{ firstId: string | null; lastId: string | null; scrollHeight: number }>(
    { firstId: null, lastId: null, scrollHeight: 0 },
  );

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    atBottomRef.current = true;
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    atBottomRef.current = distanceFromBottom < NEAR_BOTTOM;
    if (el.scrollTop < NEAR_TOP && hasMoreOlder && !isLoadingOlder) {
      // Guarda la altura ANTES del prepend para preservar la posición al insertar arriba.
      prevRef.current.scrollHeight = el.scrollHeight;
      loadOlder();
    }
  }, [hasMoreOlder, isLoadingOlder, loadOlder]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const firstId = messages[0]?.id ?? null;
    const lastId = messages[messages.length - 1]?.id ?? null;
    const prev = prevRef.current;

    if (!didInitRef.current && messages.length > 0) {
      // Primera pintura: al fondo, sin animación.
      el.scrollTop = el.scrollHeight;
      atBottomRef.current = true;
      didInitRef.current = true;
    } else if (firstId !== prev.firstId && lastId === prev.lastId && prev.scrollHeight) {
      // Prepend de historial: compensa el crecimiento para no saltar.
      el.scrollTop = el.scrollTop + (el.scrollHeight - prev.scrollHeight);
    } else if (lastId !== prev.lastId && atBottomRef.current) {
      // Mensaje nuevo al final y el usuario estaba abajo: sigue el chat.
      el.scrollTop = el.scrollHeight;
    }

    prev.firstId = firstId;
    prev.lastId = lastId;
    prev.scrollHeight = el.scrollHeight;
  }, [messages]);

  return { scrollRef, handleScroll, scrollToBottom };
}
