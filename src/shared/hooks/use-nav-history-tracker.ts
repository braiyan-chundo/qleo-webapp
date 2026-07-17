import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { useNavHistoryStore } from '@/store/nav-history.store';

/**
 * Lee el índice de history del navegador que react-router mantiene en `window.history.state.idx`.
 * Es la posición real del usuario en la pila del navegador; si por lo que sea no está, cae a 0
 * (tratado como "raíz del history" → el `BackButton` usará su fallback).
 */
function readHistoryIdx(): number {
  if (typeof window === 'undefined') return 0;
  const state = window.history.state as { idx?: number } | null;
  return typeof state?.idx === 'number' ? state.idx : 0;
}

/**
 * Registra en el store de historial (QL-140) cada cambio de ruta del área autenticada. Se monta
 * **una vez** en `AppLayout` (que permanece montado entre rutas), por lo que solo captura rutas
 * de la app —nunca `/login`— y su `useEffect` se dispara en cada navegación.
 *
 * Guardamos la entrada en la posición `idx` del history del navegador, de modo que la pila local
 * siga a la del navegador tanto al avanzar (PUSH) como al retroceder (POP). La etiqueta legible
 * NO se calcula aquí: la resuelve el `BackButton` al renderizar, contra la caché de Query.
 */
export function useNavHistoryTracker() {
  const location = useLocation();
  const visit = useNavHistoryStore((s) => s.visit);

  // `location.key` es único por entrada del history: cambia en cada navegación (incluido POP),
  // así que el efecto corre siempre que el usuario se mueve.
  useEffect(() => {
    visit(readHistoryIdx(), { path: location.pathname });
  }, [location.key, location.pathname, visit]);
}
