import { useState } from 'react';
import { Fingerprint, Loader2, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ApiError } from '@/core/api/fetch-client';

import { usePlatformAuthenticator } from '@/features/webauthn/hooks/use-platform-authenticator';
import {
  useDeletePasskey,
  useEnrollPasskey,
  useWebauthnCredentials,
} from '@/features/webauthn/hooks/use-webauthn';
import { guessDeviceName, isWebauthnCancellation } from '@/features/webauthn/lib/webauthn-support';
import type { WebauthnCredential } from '@/features/webauthn/services/webauthn.service';

/**
 * Sección "Acceso biométrico" del perfil (QL-45 F2, §3.19). Permite enrolar una passkey de
 * plataforma (Touch ID / Windows Hello / huella) en ESTE dispositivo y gestionar las passkeys
 * ya registradas (listar / eliminar). Vive en `features/profile` (encaja con el diseño de
 * `/profile`) pero consume los hooks del feature `webauthn` — igual que `NotificationsSettings`
 * consume `usePush`.
 *
 * Estados: no soportado / no disponible en este dispositivo (mensaje claro, sin botón) /
 * activo (con la lista de dispositivos). Los errores de negocio se detectan por
 * `ApiError.code`, y la cancelación de la biometría no se trata como error.
 */
export function BiometricAccessCard() {
  const { supported, available, checking } = usePlatformAuthenticator();
  const { data: credentials, isLoading } = useWebauthnCredentials();
  const enroll = useEnrollPasskey();
  const deletePasskey = useDeletePasskey();

  const [deviceName, setDeviceName] = useState(() => guessDeviceName());
  const [pendingDelete, setPendingDelete] = useState<WebauthnCredential | null>(null);

  const handleEnroll = () => {
    enroll.mutate(deviceName, {
      onSuccess: () => {
        toast.success('Acceso biométrico activado en este dispositivo.');
        setDeviceName(guessDeviceName());
      },
      onError: (err) => {
        if (isWebauthnCancellation(err)) {
          toast('Registro cancelado.');
          return;
        }
        if (err instanceof ApiError && err.code === 'WEBAUTHN_CREDENTIAL_ALREADY_REGISTERED') {
          toast.error('Este dispositivo ya tiene una passkey registrada en tu cuenta.');
          return;
        }
        if (err instanceof ApiError && err.code === 'WEBAUTHN_CHALLENGE_EXPIRED') {
          toast.error('La solicitud caducó. Inténtalo de nuevo.');
          return;
        }
        toast.error(
          err instanceof Error ? err.message : 'No se pudo activar el acceso biométrico.',
        );
      },
    });
  };

  const handleDelete = () => {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    deletePasskey.mutate(id, {
      onSuccess: () => {
        toast.success('Passkey eliminada.');
        setPendingDelete(null);
      },
      onError: (err) => {
        setPendingDelete(null);
        toast.error(err instanceof Error ? err.message : 'No se pudo eliminar la passkey.');
      },
    });
  };

  // No soportado (o comprobando): mientras `checking`, no mostramos nada para evitar parpadeos.
  if (checking) {
    return (
      <div className="flex items-center gap-2 text-sm text-on-surface-variant">
        <Loader2 className="size-4 animate-spin" />
        Comprobando compatibilidad…
      </div>
    );
  }

  if (!supported || !available) {
    return (
      <p className="rounded-lg border border-outline-variant/40 bg-surface-container px-3 py-2 text-xs text-on-surface-variant">
        No disponible en este dispositivo. Necesitas un lector biométrico (Touch ID, Windows
        Hello o huella) y, en iOS, la app instalada en la pantalla de inicio.
      </p>
    );
  }

  const hasCredentials = !!credentials && credentials.length > 0;

  return (
    <div className="grid gap-4">
      {/* Enrolar en este dispositivo */}
      <div className="grid gap-3 rounded-lg border border-outline-variant/40 bg-surface-container-low p-3">
        <div className="grid gap-1.5">
          <Label htmlFor="webauthn-device-name" className="text-xs text-on-surface">
            Nombre del dispositivo
          </Label>
          <Input
            id="webauthn-device-name"
            value={deviceName}
            maxLength={80}
            onChange={(e) => setDeviceName(e.target.value)}
            placeholder="Ej. MacBook Pro"
            className="h-10 bg-surface-bright"
          />
        </div>
        <Button
          type="button"
          onClick={handleEnroll}
          disabled={enroll.isPending}
          className="justify-center"
        >
          {enroll.isPending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Fingerprint />
          )}
          Activar acceso biométrico en este dispositivo
        </Button>
      </div>

      {/* Passkeys registradas */}
      <div className="grid gap-2">
        <p className="text-xs font-medium text-on-surface-variant">
          Dispositivos con acceso biométrico
        </p>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-on-surface-variant">
            <Loader2 className="size-4 animate-spin" />
            Cargando…
          </div>
        ) : !hasCredentials ? (
          <p className="text-sm text-on-surface-variant">
            Aún no has activado el acceso biométrico en ningún dispositivo.
          </p>
        ) : (
          <ul className="grid gap-2">
            {credentials.map((cred) => (
              <li
                key={cred.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <ShieldCheck className="size-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-on-surface">
                      {cred.deviceName || 'Dispositivo sin nombre'}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      Activado el{' '}
                      {new Date(cred.createdAt).toLocaleDateString('es-CO', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setPendingDelete(cred)}
                  disabled={deletePasskey.isPending}
                  aria-label="Eliminar passkey"
                  className="shrink-0 text-on-surface-variant hover:text-error"
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => {
          if (!o) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar acceso biométrico</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Seguro que quieres eliminar{' '}
              <span className="font-medium text-on-surface">
                {pendingDelete?.deviceName || 'este dispositivo'}
              </span>
              ? Ya no podrás entrar con biometría desde él hasta volver a activarlo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePasskey.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deletePasskey.isPending}
            >
              {deletePasskey.isPending && <Loader2 className="animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
