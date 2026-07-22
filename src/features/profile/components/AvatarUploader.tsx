import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { ImageUp, Images, Loader2, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { AuthedAvatar, identityAvatarFallback } from '@/shared/components/AuthedAvatar';
import { AvatarGalleryDialog } from '@/features/avatars/components/AvatarGalleryDialog';
import {
  AVATAR_ACCEPT_ATTR,
  avatarErrorMessage,
  validateAvatarType,
} from '@/shared/lib/avatar-file';
import type { User } from '@/store/auth.store';

import { useDeleteAvatar, useUploadAvatar } from '../hooks/use-profile';

interface AvatarUploaderProps {
  user: User;
}

/**
 * Control de foto de perfil (QL-32, §3.15): preview con `AuthedAvatar` (blob autenticado del
 * avatar subido → URL externa → iniciales), botón para **subir** una foto, (QL-181) botón para
 * **elegir de la galería** del catálogo, y botón para **quitar**. Al éxito, los hooks invalidan
 * perfil + sesión + el caché del blob, así que el cambio se refleja al instante en toda la app.
 *
 * (QL-181) La foto subida se **comprime en cliente** (256×256 WebP) dentro del hook
 * `useUploadAvatar`; aquí solo se valida el **tipo** antes (el tamaño lo revalida el hook tras
 * comprimir, por eso el copy ya no vende el límite de 2 MB como el cuello de botella real).
 */
export function AvatarUploader({ user }: AvatarUploaderProps) {
  const uploadAvatar = useUploadAvatar();
  const deleteAvatar = useDeleteAvatar();
  const inputRef = useRef<HTMLInputElement>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);

  const hasUploadedAvatar = !!user.avatarDownloadUrl;
  const busy = uploadAvatar.isPending || deleteAvatar.isPending;

  const handleFilePicked = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Permite volver a elegir el mismo archivo después.
    event.target.value = '';
    if (!file) return;

    const invalidType = validateAvatarType(file);
    if (invalidType) {
      toast.error(invalidType);
      return;
    }

    uploadAvatar.mutate(file, {
      onSuccess: () => toast.success('Foto de perfil actualizada.'),
      onError: (err) => toast.error(avatarErrorMessage(err, 'No se pudo subir la foto.')),
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
        toast.error(avatarErrorMessage(err, 'No se pudo quitar la foto.'));
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
        fallbackClassName={`${identityAvatarFallback} text-xl`}
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

          {/* (QL-181) Elegir del catálogo global de avatares. */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setGalleryOpen(true)}
            disabled={busy}
          >
            <Images />
            Elegir de la galería
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
          PNG, JPG, WEBP o GIF. Tu foto se recorta y optimiza automáticamente al subirla.
        </p>
      </div>

      <AvatarGalleryDialog
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        selectedAvatarId={user.avatarCatalogId}
      />
    </div>
  );
}
