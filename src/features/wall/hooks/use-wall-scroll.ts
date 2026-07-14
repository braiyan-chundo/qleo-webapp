import { useCallback, useLayoutEffect, useRef } from 'react';

import { wallMessageAnchorId, type WallFeedItem } from '../lib/wall-feed';

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
  // (QL-119) Mientras hay un salto en curso (buscador), no auto-seguimos al fondo: el destino es
  // un mensaje concreto, no el final del hilo. Se limpia al scrollear al mensaje objetivo.
  const jumpingRef = useRef(false);
  const prevRef = useRef<{ firstId: string | null; lastId: string | null; scrollHeight: number }>(
    { firstId: null, lastId: null, scrollHeight: 0 },
  );

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    atBottomRef.current = true;
  }, []);

  /**
   * (QL-119) Marca el inicio de un salto: suprime el auto-follow al fondo hasta que la nueva
   * ventana `around` monte y se scrollee al mensaje objetivo (`scrollToMessage`).
   */
  const beginJump = useCallback(() => {
    jumpingRef.current = true;
  }, []);

  /**
   * (QL-119) Centra el mensaje `id` en el viewport (efecto "jump to message" de WhatsApp). Se
   * llama tras cargar la ventana `around`; usa el ancla DOM del mensaje. Marca "no estoy abajo"
   * para que el polling posterior no arrastre el scroll al fondo.
   */
  const scrollToMessage = useCallback((id: string) => {
    jumpingRef.current = false;
    const node = document.getElementById(wallMessageAnchorId(id));
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    atBottomRef.current = false;
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
    } else if (lastId !== prev.lastId && atBottomRef.current && !jumpingRef.current) {
      // Mensaje nuevo al final y el usuario estaba abajo: sigue el chat. Durante un salto
      // (QL-119) NO seguimos al fondo: la ventana `around` cambia todo el hilo y el destino es
      // el mensaje buscado, al que scrollea `scrollToMessage`.
      el.scrollTop = el.scrollHeight;
    }

    prev.firstId = firstId;
    prev.lastId = lastId;
    prev.scrollHeight = el.scrollHeight;
  }, [messages]);

  return { scrollRef, handleScroll, scrollToBottom, beginJump, scrollToMessage };
}
