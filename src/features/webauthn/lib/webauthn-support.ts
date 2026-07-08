/**
 * Helpers de bajo nivel para WebAuthn / passkeys (QL-45, §3.19). Sin dependencias de React
 * ni de red: solo detección de soporte del navegador, clasificación de errores de la
 * ceremonia y un nombre de dispositivo por defecto para reconocer la passkey en el perfil.
 */

/**
 * El navegador expone la API de WebAuthn (`PublicKeyCredential`). Es el requisito mínimo:
 * sin esto ni siquiera podemos preguntar por el autenticador de plataforma.
 */
export function isWebauthnSupported(): boolean {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential;
}

/**
 * Indica si este dispositivo tiene un **autenticador de plataforma con verificación de
 * usuario** (Touch ID / Windows Hello / huella Android). Es la condición para mostrar los
 * botones biométricos: si es `false`, no ofrecemos passkeys aunque la API exista.
 *
 * Nunca lanza: ante cualquier fallo (o API ausente) resuelve `false`.
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebauthnSupported()) return false;
  if (typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') {
    return false;
  }
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * ¿El error viene de que el usuario **canceló** la biometría (o el navegador abortó la
 * ceremonia)? En ese caso no es un fallo real: la UI lo trata como un aviso suave, no como
 * un error rojo. `@simplewebauthn/browser` envuelve la cancelación en un `WebAuthnError` con
 * `code === 'ERROR_CEREMONY_ABORTED'`; por debajo suele ser un `NotAllowedError`/`AbortError`.
 */
export function isWebauthnCancellation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const code = (error as { code?: unknown }).code;
  if (code === 'ERROR_CEREMONY_ABORTED') return true;

  const name = (error as { name?: unknown }).name;
  return name === 'NotAllowedError' || name === 'AbortError';
}

/**
 * Nombre por defecto del dispositivo para etiquetar la passkey (`deviceName`), derivado del
 * sistema operativo y el navegador. El usuario lo verá en su lista de "dispositivos con
 * acceso biométrico"; puede editarlo antes de enrolar.
 */
export function guessDeviceName(): string {
  if (typeof navigator === 'undefined') return 'Este dispositivo';

  const ua = navigator.userAgent;

  const os =
    /Windows/i.test(ua) ? 'Windows'
    : /Macintosh|Mac OS X/i.test(ua) ? 'Mac'
    : /iPhone/i.test(ua) ? 'iPhone'
    : /iPad/i.test(ua) ? 'iPad'
    : /Android/i.test(ua) ? 'Android'
    : /Linux/i.test(ua) ? 'Linux'
    : '';

  const browser =
    /Edg\//i.test(ua) ? 'Edge'
    : /OPR\/|Opera/i.test(ua) ? 'Opera'
    : /Chrome\//i.test(ua) ? 'Chrome'
    : /Firefox\//i.test(ua) ? 'Firefox'
    : /Safari\//i.test(ua) ? 'Safari'
    : '';

  const label = [os, browser].filter(Boolean).join(' · ');
  return label || 'Este dispositivo';
}
