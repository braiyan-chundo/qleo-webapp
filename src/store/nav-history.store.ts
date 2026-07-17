import { create } from 'zustand';

/**
 * Estado de CLIENTE puro (QL-140): el historial de navegación **interno** de la app. No es
 * dato de servidor —es dónde ha estado el usuario dentro del router—, por eso vive en Zustand
 * y no en la caché de TanStack Query.
 *
 * ## Cómo se mantiene sincronizado con el navegador
 * Las entradas se **indexan por el índice del history del navegador** que react-router guarda en
 * `window.history.state.idx`. Así el stack refleja la posición real del usuario en la pila del
 * navegador: cuando pulsa "atrás" (o `navigate(-1)`) el `idx` baja y la "entrada anterior" que
 * lee el `BackButton` (`idx - 1`) siempre coincide con el destino real del `navigate(-1)`. Un
 * stack que solo crece (push en cada cambio de ruta) se desincronizaría al volver atrás y luego
 * navegar de nuevo.
 *
 * ## No se persiste (a propósito)
 * El store arranca vacío en cada carga. Un deep-link / pestaña nueva no tiene entrada previa
 * registrada → `BackButton` cae a su `fallback` (padre lógico), que es justo lo que se quiere.
 * Solo se alimenta desde el área autenticada (`AppLayout`), no desde `/login`.
 */

/** Una ruta visitada. Guardamos el `pathname`; la etiqueta legible se resuelve en el render. */
export interface NavHistoryEntry {
  /** `pathname` de la ruta (sin query): suficiente para resolver la etiqueta del tooltip. */
  path: string;
}

interface NavHistoryState {
  /** Entradas indexadas por el `idx` del history del navegador. */
  entries: Record<number, NavHistoryEntry>;
  /** Índice actual dentro del history del navegador. */
  currentIdx: number;
  /** Registra la visita a una ruta en su posición (`idx`) del history del navegador. */
  visit: (idx: number, entry: NavHistoryEntry) => void;
}

export const useNavHistoryStore = create<NavHistoryState>((set) => ({
  entries: {},
  currentIdx: 0,
  visit: (idx, entry) =>
    set((state) => ({
      currentIdx: idx,
      entries: { ...state.entries, [idx]: entry },
    })),
}));

/**
 * Selector: la entrada **anterior** a la actual, o `undefined` si no la hay (estamos en la raíz
 * del history de esta sesión, o llegamos por deep-link y nunca registramos la previa). Devuelve
 * la referencia estable guardada en el store, así que es seguro usarlo como selector de Zustand.
 */
export const selectPreviousNavEntry = (
  state: NavHistoryState,
): NavHistoryEntry | undefined =>
  state.currentIdx > 0 ? state.entries[state.currentIdx - 1] : undefined;
