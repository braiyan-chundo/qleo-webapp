/**
 * Capacidades del dispositivo: feature-detection pura del navegador (sin React, sin red, sin
 * sniffing de user-agent). Sirve para decidir degradaciones de UX que dependen del hardware, no
 * del tamaño de la ventana (para eso está `useIsMobile`, que mide el viewport).
 */

/**
 * `true` en dispositivos manejados con el dedo (móvil / tablet). Es la señal que usamos para NO
 * abrir un segundo consumidor del micrófono durante el dictado (QL-191): en Android, tener a la vez
 * el `SpeechRecognition` y un `getUserMedia` degrada o rompe el reconocimiento.
 *
 * Se combinan las dos señales disponibles y basta con que una dé positivo: ante la duda preferimos
 * el falso positivo (un portátil táctil ve la onda sintética en vez de la real, un detalle
 * cosmético) antes que el falso negativo (perder la transcripción, que es lo que importa).
 */
export function isCoarsePointerDevice(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches) {
    return true;
  }
  return typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
}
