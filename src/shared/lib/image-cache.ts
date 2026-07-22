/**
 * (QL-182, §3.60) Nombre de la caché del Service Worker donde persisten las imágenes de la app
 * (avatares de usuario, catálogo y adjuntos-imagen) durante 1 día.
 *
 * Fuente **única** del nombre: lo importan tanto `sw.ts` (que registra la ruta CacheFirst) como
 * el flujo de cierre de sesión (que la vacía). Vive en un módulo de constantes —sin código de
 * arranque— para poder importarlo desde la app sin arrastrar el service worker.
 *
 * Versionado (`-v1`): si algún día cambia el esquema de lo que se guarda, se sube el sufijo para
 * no reutilizar entradas viejas.
 */
export const IMAGE_CACHE_NAME = 'qleo-images-v1';

/**
 * Vacía la caché de imágenes del SW. Se llama **al cerrar sesión**: las peticiones van
 * autenticadas pero la caché del SW se indexa por URL, así que en un equipo compartido las fotos
 * del usuario anterior seguirían sirviéndose desde caché al siguiente. Best-effort y con
 * feature-detection (`caches` no existe en contextos sin SW, p. ej. algunos tests o SSR).
 */
export async function clearImageCache(): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    await caches.delete(IMAGE_CACHE_NAME);
  } catch {
    // Best-effort: si el navegador no deja borrar la caché, no bloqueamos el logout.
  }
}
