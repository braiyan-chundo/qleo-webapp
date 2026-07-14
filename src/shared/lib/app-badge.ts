/**
 * Badging API del lado del cliente (QL-118, §3.17). Pinta/limpia el contador numérico del
 * icono de la app (estilo WhatsApp) mientras la PWA está abierta. Es la contraparte del
 * badge que pinta el service worker (`src/sw.ts`) cuando llega un push con la app cerrada.
 *
 * Sin dependencias de React ni de red: solo feature-detection + llamada segura a la API del
 * navegador. `lib.dom` no siempre tipa la Badging API, así que la declaramos de forma mínima.
 */

interface BadgingNavigator {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
}

/** Pinta el badge del icono con `count`. No-op silencioso si el navegador no soporta la API. */
export function setAppBadge(count: number): void {
  const nav = navigator as Navigator & BadgingNavigator;
  if (typeof nav.setAppBadge !== 'function') return;
  // La promesa puede rechazar (permiso/instalación); no debe propagar ni romper la UI.
  void nav.setAppBadge(count).catch(() => undefined);
}

/** Limpia el badge del icono. No-op silencioso si el navegador no soporta la API. */
export function clearAppBadge(): void {
  const nav = navigator as Navigator & BadgingNavigator;
  if (typeof nav.clearAppBadge !== 'function') return;
  void nav.clearAppBadge().catch(() => undefined);
}
