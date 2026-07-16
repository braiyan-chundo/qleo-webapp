import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import {
  authService,
  type PasswordResetConfirmDto,
  type PasswordResetRequestDto,
  type PasswordResetVerifyDto,
} from '../services/auth.service';
import { rememberAccount } from '../lib/last-account';
import { useAuthStore } from '@/store/auth.store';

/**
 * Hooks del flujo "¿Olvidaste tu contraseña?" (OTP por correo, §3.30). Como cualquier dato
 * del servidor, pasan por TanStack Query; las páginas NO llaman al service ni manejan
 * loading/error a mano. Ver skill `react-data-fetching`.
 */

/**
 * Paso 1 — solicita el envío del código OTP al correo. El backend responde **siempre 200**
 * (anti-enumeración), así que la UI muestra un mensaje genérico pase lo que pase.
 */
export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: (dto: PasswordResetRequestDto) => authService.requestPasswordReset(dto),
  });
}

/**
 * Paso 2 — valida el OTP antes de pedir la contraseña (no lo consume). Los errores de
 * negocio (`OTP_INVALID`/`OTP_EXPIRED`/`OTP_ATTEMPTS_EXCEEDED`) llegan como `ApiError`
 * (con `.code`) en `mutation.error`; la página los mapea a un mensaje.
 */
export function useVerifyPasswordResetOtp() {
  return useMutation({
    mutationFn: (dto: PasswordResetVerifyDto) => authService.verifyPasswordResetOtp(dto),
  });
}

/**
 * Paso 3 — aplica la nueva contraseña y consume el OTP. La respuesta es el mismo
 * `AuthResponse` del login, así que iniciamos sesión automáticamente con el MISMO mecanismo
 * (`setCredentials` + `rememberAccount`) y navegamos al inicio autenticado.
 */
export function useConfirmPasswordReset() {
  const navigate = useNavigate();
  const setCredentials = useAuthStore((s) => s.setCredentials);

  return useMutation({
    mutationFn: (dto: PasswordResetConfirmDto) => authService.confirmPasswordReset(dto),
    onSuccess: (res) => {
      setCredentials(res.accessToken, res.user);
      // QL-44: recuerda la cuenta (incl. avatar) sin bloquear el redirect.
      void rememberAccount(res.user);
      navigate('/', { replace: true });
    },
  });
}
