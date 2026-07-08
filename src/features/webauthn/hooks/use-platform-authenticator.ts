import { useEffect, useState } from 'react';

import {
  isPlatformAuthenticatorAvailable,
  isWebauthnSupported,
} from '../lib/webauthn-support';

/**
 * Estado de soporte de passkeys de plataforma en este dispositivo. `supported` = la API de
 * WebAuthn existe; `available` = además hay un autenticador de plataforma con verificación de
 * usuario (Touch ID / Windows Hello / huella). `checking` = la comprobación async sigue en
 * curso (evita parpadeos: no muestres nada hasta que termine).
 */
export interface PlatformAuthenticatorState {
  supported: boolean;
  available: boolean;
  checking: boolean;
}

/**
 * Hook de detección de soporte biométrico (QL-45, §3.19). Resuelve de forma asíncrona si el
 * dispositivo puede usar passkeys de plataforma y expone `{ supported, available, checking }`
 * para mostrar u ocultar la UI. `isUserVerifyingPlatformAuthenticatorAvailable()` es async,
 * así que arrancamos con `available:false, checking:true` y actualizamos al resolver.
 *
 * No hace red: es puramente capacidad del navegador ⇒ estado de cliente, no TanStack Query.
 */
export function usePlatformAuthenticator(): PlatformAuthenticatorState {
  const supported = isWebauthnSupported();
  const [available, setAvailable] = useState(false);
  const [checking, setChecking] = useState(supported);

  useEffect(() => {
    if (!supported) {
      setChecking(false);
      return;
    }

    let cancelled = false;
    setChecking(true);

    isPlatformAuthenticatorAvailable()
      .then((result) => {
        if (!cancelled) setAvailable(result);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [supported]);

  return { supported, available, checking };
}
