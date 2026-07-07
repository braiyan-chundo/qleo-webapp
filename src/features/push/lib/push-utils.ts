/**
 * Helpers de bajo nivel para Web Push (QL-30, §3.17). Sin dependencias de React ni de red;
 * solo conversión de la clave VAPID y detección de soporte del navegador.
 */

/**
 * Indica si el navegador soporta Web Push. En iOS solo funciona con la app instalada en la
 * pantalla de inicio (iOS 16.4+), donde estas tres APIs están presentes.
 */
export function isPushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Convierte la clave pública VAPID (base64url) al `Uint8Array` que espera
 * `pushManager.subscribe({ applicationServerKey })`.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  // Se aloja sobre un `ArrayBuffer` explícito para que el tipo sea `Uint8Array<ArrayBuffer>`
  // (no `ArrayBufferLike`) y encaje en `BufferSource` de `applicationServerKey`.
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}
