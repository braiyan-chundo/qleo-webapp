import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';

import { webauthnService } from '../services/webauthn.service';
import { rememberAccount } from '@/features/auth/lib/last-account';
import { useAuthStore } from '@/store/auth.store';
import { getFromPath } from '@/shared/lib/router-state';

/**
 * Hooks de datos del feature WebAuthn / passkeys (QL-45, §3.19). Toda la interacción con la
 * API pasa por aquí: los componentes usan estos hooks y nunca llaman al service ni orquestan
 * el flujo de la ceremonia a mano. El estado del servidor (passkeys registradas) vive en la
 * caché de TanStack Query; la sesión se persiste reutilizando el store de `features/auth`.
 */

/** Claves de query del feature. Centralizadas para invalidación consistente. */
export const webauthnKeys = {
  credentials: ['webauthn', 'credentials'] as const,
};

/**
 * Passkeys registradas del usuario autenticado ("dispositivos con acceso biométrico"). Solo
 * corre si hay sesión.
 */
export function useWebauthnCredentials() {
  const token = useAuthStore((s) => s.accessToken);

  return useQuery({
    queryKey: webauthnKeys.credentials,
    queryFn: () => webauthnService.listCredentials(),
    enabled: !!token,
  });
}

/**
 * Enrola una passkey en ESTE dispositivo (flujo A, autenticado): pide opciones →
 * `startRegistration({ optionsJSON })` (dispara Touch ID / Windows Hello) → verifica y crea
 * la passkey con un `deviceName` opcional. Al terminar, refresca la lista de passkeys.
 *
 * Debe invocarse desde un gesto del usuario (la ceremonia de WebAuthn lo exige). La
 * cancelación del navegador la clasifica la UI con `isWebauthnCancellation`.
 */
export function useEnrollPasskey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (deviceName?: string) => {
      const optionsJSON = await webauthnService.registerOptions();
      const response = await startRegistration({ optionsJSON });
      return webauthnService.registerVerify({
        response,
        deviceName: deviceName?.trim() || undefined,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: webauthnKeys.credentials });
    },
  });
}

/** Elimina una passkey por id (flujo C). Refresca la lista al terminar. */
export function useDeletePasskey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => webauthnService.deleteCredential(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: webauthnKeys.credentials });
    },
  });
}

/**
 * Login con passkey (flujo B, público): pide opciones para el email →
 * `startAuthentication({ optionsJSON })` (biometría) → verifica y recibe `{ accessToken, user }`
 * **idéntico a `/auth/login`**. En `onSuccess` reutiliza EXACTAMENTE el post-login por
 * contraseña (`useLogin`): guarda credenciales en el store, cachea la última cuenta (QL-44) y
 * navega a la ruta previa (`state.from`) o al inicio (QL-49).
 *
 * Si `login/options` responde `WEBAUTHN_NO_CREDENTIALS`, el error llega al componente (vía
 * `ApiError.code`) para caer a contraseña sin ruido.
 */
export function useWebauthnLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const setCredentials = useAuthStore((s) => s.setCredentials);

  return useMutation({
    mutationFn: async (email: string) => {
      const optionsJSON = await webauthnService.loginOptions(email);
      const response = await startAuthentication({ optionsJSON });
      return webauthnService.loginVerify(response);
    },
    onSuccess: (res) => {
      setCredentials(res.accessToken, res.user);
      // QL-44: recuerda la cuenta (incl. avatar) sin bloquear el redirect.
      void rememberAccount(res.user);
      navigate(getFromPath(location.state) ?? '/', { replace: true });
    },
  });
}
