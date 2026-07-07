import type { Location } from 'react-router-dom';

/**
 * Estado que `SessionGate` adjunta al redirigir a `/login` para recordar de dónde venía
 * el usuario y devolverlo allí tras autenticarse (QL-49). Tipado explícito para no usar
 * `any` al leer `location.state`.
 */
export interface FromLocationState {
  from?: Location;
}

/**
 * Extrae de forma segura la ruta previa (`state.from.pathname`) de un `location.state`
 * desconocido. Devuelve `undefined` si el estado no tiene la forma esperada o apunta al
 * propio `/login` (para no crear bucles de redirección).
 */
export function getFromPath(state: unknown): string | undefined {
  if (!state || typeof state !== 'object' || !('from' in state)) return undefined;

  const from = (state as FromLocationState).from;
  if (!from || typeof from.pathname !== 'string') return undefined;

  return from.pathname === '/login' ? undefined : from.pathname;
}
