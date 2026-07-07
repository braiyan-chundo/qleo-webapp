import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { ImageUp, Loader2, Trash2 } from 'lucide-react';

import { ApiError } from '@/core/api/fetch-client';
import { Button } from '@/components/ui/button';
import { AuthedAvatar } from '@/shared/components/AuthedAvatar';
import type { User } from '@/store/auth.store';

import { useDeleteAvatar, useUploadAvatar } from '../hooks/use-profile';
import {
  AVATAR_ACCEPT_ATTR,
  validateAvatarFile,
} from '../lib/avatar-file';

interface AvatarUploaderProps {
  user: User;
}

/**
 * Traduce un fallo de avatar a un toast según §3.15: reacciona al `err.code`
 * (`FILE_TOO_LARGE` / `UNSUPPORTED_FILE_TYPE`), no al texto.
 */
function notifyAvatarError(err: unknown, fallback: string) {
  if (err instanceof ApiError) {
    if (err.code === 'FILE_TOO_LARGE') {
      toast.error('La imagen supera el límite de 2 MB.');
      return;
    }
    if (err.code === 'UNSUPPORTED_FILE_TYPE') {
      toast.error('Formato no permitido. Usa PNG, JPG, WEBP o GIF.');
      return;
    }
    toast.error(err.message);
    return;
  }
  toast.error(err instanceof Error ? err.message : fallback);
}

/**
 * Control de foto de perfil (QL-32, §3.15): preview con `AuthedAvatar` (blob autenticado del
 * avatar subido → URL externa → iniciales), botón para subir (valida 2 MB / imagen en cliente
 * antes de enviar) y botón para quitar. Al éxito, los hooks invalidan perfil + sesión + el
 * caché del blob, así que el cambio se refleja al instante en toda la app.
 */
export function AvatarUploader({ user }: AvatarUploaderProps) {
  const uploadAvatar = useUploadAvatar();
  const deleteAvatar = useDeleteAvatar();
  const inputRef = useRef<HTMLInputElement>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const hasUploadedAvatar = !!user.avatarDownloadUrl;
  const busy = uploadAvatar.isPending || deleteAvatar.isPending;

  const handleFilePicked = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Permite volver a elegir el mismo archivo después.
    event.target.value = '';
    if (!file) return;

    const invalid = validateAvatarFile(file);
    if (invalid) {
      toast.error(invalid);
      return;
    }

    uploadAvatar.mutate(file, {
      onSuccess: () => toast.success('Foto de perfil actualizada.'),
      onError: (err) => notifyAvatarError(err, 'No se pudo subir la foto.'),
    });
  };

  const handleRemove = () => {
    deleteAvatar.mutate(undefined, {
      onSuccess: () => {
        setConfirmRemove(false);
        toast.success('Foto de perfil eliminada.');
      },
      onError: (err) => {
        setConfirmRemove(false);
        notifyAvatarError(err, 'No se pudo quitar la foto.');
      },
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      <AuthedAvatar
        size="lg"
        className="size-16 border border-outline-variant/50"
        avatarDownloadUrl={user.avatarDownloadUrl}
        avatarUrl={user.avatarUrl}
        name={user.name}
        fallbackClassName="bg-primary-container text-primary text-xl font-bold"
      />

      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={AVATAR_ACCEPT_ATTR}
            className="hidden"
            onChange={handleFilePicked}
            disabled={busy}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {uploadAvatar.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <ImageUp />
            )}
            {hasUploadedAvatar ? 'Cambiar foto' : 'Subir foto'}
          </Button>

          {hasUploadedAvatar &&
            (confirmRemove ? (
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-error hover:bg-error-container hover:text-on-error-container"
                  onClick={handleRemove}
                  disabled={deleteAvatar.isPending}
                >
                  {deleteAvatar.isPending && <Loader2 className="animate-spin" />}
                  Confirmar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmRemove(false)}
                  disabled={deleteAvatar.isPending}
                >
                  Cancelar
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-on-surface-variant hover:text-error"
                onClick={() => setConfirmRemove(true)}
                disabled={busy}
              >
                <Trash2 />
                Quitar
              </Button>
            ))}
        </div>
        <p className="text-xs text-on-surface-variant">
          PNG, JPG, WEBP o GIF · máx. 2 MB.
        </p>
      </div>
    </div>
  );
}
