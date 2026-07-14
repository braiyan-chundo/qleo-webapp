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

/**
 * Normaliza una clave base64/base64url a **base64url sin padding** para poder compararla.
 * La clave VAPID del servidor ya viene en base64url, pero normalizamos ambos lados por si
 * acaso (variantes con `+`/`/` o con `=` de relleno).
 */
function toBase64Url(value: string): string {
  return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Convierte el `ArrayBuffer` de `subscription.options.applicationServerKey` a base64url sin
 * padding, para compararlo con la clave pública VAPID (que también es base64url).
 */
function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return toBase64Url(window.btoa(binary));
}

/**
 * Compara la `applicationServerKey` con la que se suscribió el navegador (QL-118) contra la
 * clave pública VAPID **actual** del servidor. Si NO coinciden, la suscripción quedó atada a
 * una clave vieja y el push service la rechaza (403) sin avisar → los push "solo llegan al
 * abrir la app". La forma robusta: normalizar ambas a base64url antes de comparar.
 *
 * Devuelve `false` cuando la clave de la suscripción es `null` (no se puede verificar ⇒ tratar
 * como desajuste para forzar la re-suscripción con la clave correcta).
 */
export function applicationServerKeyMatches(
  subscriptionKey: ArrayBuffer | null,
  vapidPublicKey: string,
): boolean {
  if (!subscriptionKey || !vapidPublicKey) return false;
  return arrayBufferToBase64Url(subscriptionKey) === toBase64Url(vapidPublicKey);
}
