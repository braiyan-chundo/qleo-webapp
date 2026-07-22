import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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
import { avatarErrorMessage } from '@/shared/lib/avatar-file';

import { useDeleteCatalogAvatar } from '../hooks/use-avatars';
import type { CatalogAvatar } from '../services/avatars.service';

interface DeleteAvatarDialogProps {
  /** Avatar a borrar; `null` mantiene el diálogo cerrado. */
  avatar: CatalogAvatar | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * (QL-181, §3.59, **solo ADMIN**) Confirmación de borrado de un avatar del catálogo.
 *
 * A diferencia del borrado de etiquetas, **no** hay cascada sobre los usuarios: al elegir un
 * avatar el backend **copia** el binario al almacén del usuario, así que quien ya lo tenía
 * puesto conserva su foto. Lo único que se pierde es la opción en el selector; el copy lo dice
 * explícitamente para que el ADMIN no crea que va a dejar a gente sin foto.
 */
export function DeleteAvatarDialog({ avatar, onOpenChange }: DeleteAvatarDialogProps) {
  const deleteAvatar = useDeleteCatalogAvatar();

  const handleConfirm = () => {
    if (!avatar) return;
    deleteAvatar.mutate(avatar.id, {
      onSuccess: () => {
        toast.success(`Avatar "${avatar.name}" eliminado del catálogo.`);
        onOpenChange(false);
      },
      onError: (err) => {
        toast.error(avatarErrorMessage(err, 'No se pudo eliminar el avatar.'));
      },
    });
  };

  return (
    <AlertDialog open={!!avatar} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar avatar del catálogo</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Vas a quitar{' '}
                <span className="font-medium text-on-surface">{avatar?.name}</span> de la galería.
                Dejará de aparecer en el selector de foto de perfil.
              </p>
              <p>
                Quien ya lo tenga puesto{' '}
                <span className="font-medium text-on-surface">conserva su foto</span>: al elegir un
                avatar se copia la imagen a su perfil, no se enlaza a esta.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteAvatar.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={deleteAvatar.isPending}
            className="bg-error text-on-error hover:bg-error/90"
          >
            {deleteAvatar.isPending && <Loader2 className="animate-spin" />}
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
