import { useState } from 'react';
import { Fingerprint, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ApiError } from '@/core/api/fetch-client';

import { usePlatformAuthenticator } from '@/features/webauthn/hooks/use-platform-authenticator';
import { useWebauthnLogin } from '@/features/webauthn/hooks/use-webauthn';
import { isWebauthnCancellation } from '@/features/webauthn/lib/webauthn-support';
import { getLastAccount } from '../lib/last-account';

interface BiometricLoginButtonProps {
  /** Email actualmente escrito en el formulario de login (`loginForm.watch('email')`). */
  typedEmail: string;
  /** Deshabilita el botón mientras el login por contraseña está en curso. */
  disabled?: boolean;
}

/**
 * Botón "Entrar con huella" del login (QL-45 F3, §3.19). Solo se renderiza si el dispositivo
 * tiene autenticador de plataforma disponible. Resuelve el email en cascada: lo escrito en el
 * formulario (prioridad si el usuario tecleó) → la **cuenta recordada** (QL-44) para UX de un
 * toque. Tras verificar, el post-login (guardar sesión + redirect al `from`) lo hace
 * `useWebauthnLogin`, idéntico al login por contraseña.
 *
 * Estados: sin email (pide escribirlo o elegir la cuenta recordada), `WEBAUTHN_NO_CREDENTIALS`
 * ("no hay passkey para esta cuenta en este dispositivo"), y cancelación por el usuario
 * (aviso suave, no error rojo).
 */
export function BiometricLoginButton({ typedEmail, disabled }: BiometricLoginButtonProps) {
  const { available, checking } = usePlatformAuthenticator();
  const login = useWebauthnLogin();
  const [message, setMessage] = useState<string | null>(null);

  // No mostramos nada mientras comprobamos ni si el dispositivo no soporta biometría.
  if (checking || !available) return null;

  const resolveEmail = (): string | null => {
    const typed = typedEmail.trim();
    if (typed) return typed;
    const remembered = getLastAccount();
    return remembered?.email ?? null;
  };

  const handleClick = () => {
    setMessage(null);
    const email = resolveEmail();
    if (!email) {
      setMessage('Escribe tu correo (o elige tu cuenta) para entrar con huella.');
      return;
    }

    login.mutate(email, {
      onError: (err) => {
        if (isWebauthnCancellation(err)) {
          setMessage('Autenticación cancelada.');
          return;
        }
        if (err instanceof ApiError && err.code === 'WEBAUTHN_NO_CREDENTIALS') {
          setMessage('No hay acceso biométrico para esta cuenta en este dispositivo. Usa tu contraseña.');
          return;
        }
        if (err instanceof ApiError && err.code === 'WEBAUTHN_CHALLENGE_EXPIRED') {
          setMessage('La solicitud caducó. Inténtalo de nuevo.');
          return;
        }
        setMessage(err instanceof Error ? err.message : 'No se pudo entrar con huella.');
      },
    });
  };

  return (
    <div className="space-y-2 sm:space-y-3">
      {/* Divisor */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-outline-variant/40" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-surface-container-lowest px-4 text-xs font-medium text-outline">
            o
          </span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={handleClick}
        disabled={disabled || login.isPending}
        className="h-12 sm:h-13 w-full rounded-xl border-outline-variant/60 bg-surface-container-lowest text-base font-semibold text-on-surface hover:bg-surface-container-low"
      >
        {login.isPending ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <Fingerprint className="size-5" />
        )}
        Entrar con huella
      </Button>

      {message && (
        <p className="text-center text-xs font-medium text-on-surface-variant">{message}</p>
      )}
    </div>
  );
}
