import { useCallback, useSyncExternalStore } from 'react';

/**
 * (QL-170) Reloj compartido: reemite cada minuto para que los componentes cuyo estado depende
 * del **paso del tiempo** (y no de un cambio de datos) se reevalúen solos. Caso de uso: la
 * ventana de 5 min para editar/eliminar un mensaje del muro — al montar es editable y deja de
 * serlo sin que llegue nada del servidor.
 *
 * Es **un solo `setInterval` para toda la app** (store externo con suscriptores), no uno por
 * componente: montar 200 burbujas del muro no crea 200 timers. El intervalo se crea con el
 * primer suscriptor y se limpia cuando se va el último.
 */

/** Cadencia del reloj. Un minuto basta: nadie percibe 30 s de desfase en un gate de 5 min. */
const TICK_MS = 60_000;

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
// Snapshot estable entre ticks: `useSyncExternalStore` exige que no cambie sin notificación.
let snapshot = Date.now();

function emit() {
  snapshot = Date.now();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (timer === null) timer = setInterval(emit, TICK_MS);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot(): number {
  return snapshot;
}

/**
 * Devuelve un timestamp que cambia una vez por minuto (usarlo como base de cálculos "ahora").
 * `enabled=false` no suscribe: un componente que no depende del tiempo no paga re-renders.
 */
export function useMinuteTick(enabled = true): number {
  const subscribeIfEnabled = useCallback(
    (listener: () => void) => (enabled ? subscribe(listener) : () => {}),
    [enabled],
  );
  return useSyncExternalStore(subscribeIfEnabled, getSnapshot);
}
