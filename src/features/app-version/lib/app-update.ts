import { compareSemver } from './semver';

/**
 * Acción "Actualizar" del aviso de nueva versión (QL-148, §3.43). Refresca la app al build nuevo
 * **sin cerrar sesión**: purga la Cache Storage (app shell de Workbox), fuerza el service worker
 * nuevo y recarga. NUNCA se toca `localStorage` ni el token → la sesión sobrevive a la recarga.
 */

/**
 * Clave en `sessionStorage` que marca una actualización en curso, con la versión objetivo. Tras la
 * recarga se consume para mostrar el toast "Nueva versión cargada" solo si el build ya la alcanzó.
 */
const UPDATE_FLAG_KEY = 'qleo:pending-version-update';

/**
 * Purga la caché del cliente, fuerza el service worker propio (`src/sw.ts`, que hace `skipWaiting`
 * + `clients.claim`) y recarga. Best-effort: si un paso falla, igualmente recarga (la recarga con
 * la caché limpia + SW nuevo basta para tomar el build nuevo). Solo la sesión se preserva.
 */
export async function applyAppUpdate(targetVersion: string): Promise<void> {
  // 1. Cache Storage: elimina el app shell cacheado para que la recarga tome el build nuevo de red.
  //    NO toca `localStorage` (donde vive el token de sesión), solo `caches`.
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    // Ignorado: si no se puede limpiar la caché, el SW nuevo + recarga suele bastar igual.
  }

  // 2. Service worker: pide el build nuevo. `src/sw.ts` llama `self.skipWaiting()` al instalarse y
  //    `clients.claim()` al activarse, así que el SW nuevo toma el control sin esperar. Si quedara
  //    uno en "waiting", le mandamos `SKIP_WAITING` (el SW escucha ese mensaje, QL-148).
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.update();
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      }
    }
  } catch {
    // Ignorado: la recarga de abajo toma el build nuevo aunque el SW no coopere.
  }

  // 3. Marca para el toast post-recarga y recarga. El token vive en localStorage → la sesión sobrevive.
  try {
    sessionStorage.setItem(UPDATE_FLAG_KEY, targetVersion);
  } catch {
    // sessionStorage no disponible: seguimos sin el toast de confirmación (no es crítico).
  }
  window.location.reload();
}

/**
 * Tras recargar: si había una actualización pendiente y el build cargado ya alcanzó (o superó) la
 * versión objetivo, devuelve esa versión (para el toast) y limpia la marca. Si no hay marca, o el
 * build aún no llegó a la versión objetivo, devuelve `null` (y limpia igualmente para no reintentar).
 */
export function consumePendingUpdate(currentVersion: string): string | null {
  let target: string | null = null;
  try {
    target = sessionStorage.getItem(UPDATE_FLAG_KEY);
  } catch {
    return null;
  }
  if (!target) return null;
  try {
    sessionStorage.removeItem(UPDATE_FLAG_KEY);
  } catch {
    // Ignorado: si no se puede limpiar, el toast podría repetirse una vez; inofensivo.
  }
  return compareSemver(currentVersion, target) >= 0 ? target : null;
}
