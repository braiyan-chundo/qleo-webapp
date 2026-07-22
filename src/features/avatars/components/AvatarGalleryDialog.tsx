import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { avatarErrorMessage } from '@/shared/lib/avatar-file';

import { useAvatarCatalog, useChooseAvatarFromCatalog } from '../hooks/use-avatars';
import { CatalogAvatarTile } from './CatalogAvatarTile';

interface AvatarGalleryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Avatar del catálogo actualmente elegido (`user.avatarCatalogId`), para marcarlo. */
  selectedAvatarId?: string | null;
}

/**
 * (QL-181, §3.59) Selector "Elegir de la galería" del perfil: abre la rejilla del catálogo y, al
 * pulsar una foto, llama a `POST /users/me/avatar/from-catalog`. El cierre (invalidar perfil,
 * sesión y el blob del avatar) lo hace el hook `useChooseAvatarFromCatalog`, idéntico a subir una
 * foto propia — para el backend es lo mismo (copia el binario y emite `user-avatar`).
 *
 * La opción actual se marca con `user.avatarCatalogId`. Si ese id ya no está en el catálogo
 * (el ADMIN lo borró), simplemente no se marca ninguna.
 *
 * Caso normal, no error: si el ADMIN borra un avatar con este diálogo abierto, elegirlo devuelve
 * **404 `AVATAR_NOT_FOUND`** → refrescamos el catálogo (la query se invalida sola) y pedimos
 * elegir otro, sin tratarlo como fallo de ruta.
 */
export function AvatarGalleryDialog({
  open,
  onOpenChange,
  selectedAvatarId,
}: AvatarGalleryDialogProps) {
  // La query solo se dispara con el diálogo abierto.
  const { data, isLoading, isError, error, refetch } = useAvatarCatalog({ enabled: open });
  const chooseAvatar = useChooseAvatarFromCatalog();

  const avatars = data ?? [];

  const handleChoose = (avatarId: string) => {
    if (chooseAvatar.isPending) return;
    chooseAvatar.mutate(avatarId, {
      onSuccess: () => {
        toast.success('Foto de perfil actualizada.');
        onOpenChange(false);
      },
      onError: (err) => {
        // (§3.59) 404 `AVATAR_NOT_FOUND` = el ADMIN lo borró mientras tanto: el helper ya lo
        // traduce a "Ese avatar ya no está en el catálogo" y refrescamos para pedir otro.
        toast.error(avatarErrorMessage(err, 'No se pudo elegir el avatar.'));
        refetch();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Elegir de la galería</DialogTitle>
          <DialogDescription>
            Elige una foto del catálogo. Se copiará a tu perfil como tu avatar.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-xl border border-error/20 bg-error-container px-6 py-10 text-center">
            <p className="text-sm font-medium text-on-error-container">
              No se pudo cargar la galería
            </p>
            <p className="mt-1 text-xs text-on-error-container/80">
              {error instanceof Error ? error.message : 'Error desconocido'}
            </p>
          </div>
        ) : avatars.length === 0 ? (
          <p className="py-10 text-center text-sm text-on-surface-variant">
            El catálogo de avatares aún está vacío. Un administrador puede añadir fotos desde
            Configuración.
          </p>
        ) : (
          <ul className="grid grid-cols-3 gap-4 sm:grid-cols-4">
            {avatars.map((avatar) => {
              const isSelected = avatar.id === selectedAvatarId;
              const isChoosing =
                chooseAvatar.isPending && chooseAvatar.variables === avatar.id;
              return (
                <li key={avatar.id}>
                  <button
                    type="button"
                    className="group relative w-full rounded-xl p-1 transition-colors hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
                    onClick={() => handleChoose(avatar.id)}
                    disabled={chooseAvatar.isPending}
                    aria-pressed={isSelected}
                  >
                    <CatalogAvatarTile avatar={avatar} selected={isSelected} />
                    {isChoosing && (
                      <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-surface/60">
                        <Loader2 className="size-5 animate-spin text-primary" />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
