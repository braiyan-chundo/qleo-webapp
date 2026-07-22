import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label as FieldLabel } from '@/components/ui/label';
import { avatarErrorMessage } from '@/shared/lib/avatar-file';

import { useRenameCatalogAvatar } from '../hooks/use-avatars';
import type { CatalogAvatar } from '../services/avatars.service';
import { CatalogAvatarTile } from './CatalogAvatarTile';

interface RenameAvatarDialogProps {
  /** Avatar en edición; `null` mantiene el diálogo cerrado. */
  avatar: CatalogAvatar | null;
  onOpenChange: (open: boolean) => void;
}

/** Mismo tope que aplica el backend al derivar el nombre de un archivo (§3.59). */
const MAX_NAME = 60;

/**
 * (QL-181, §3.59, **solo ADMIN**) Renombra un avatar del catálogo (`PATCH /avatars/:id`). Es lo
 * único editable: el binario es inmutable por id (para cambiar la imagen se sube otra y se borra
 * esta), lo que además es lo que permite cachearla un día entero (QL-182).
 */
export function RenameAvatarDialog({ avatar, onOpenChange }: RenameAvatarDialogProps) {
  const renameAvatar = useRenameCatalogAvatar();
  const [name, setName] = useState('');

  // Rehidrata el campo cada vez que se abre con otro avatar.
  useEffect(() => {
    if (!avatar) return;
    setName(avatar.name);
  }, [avatar]);

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && !renameAvatar.isPending;

  const handleSave = () => {
    if (!avatar || !canSubmit) return;
    if (trimmed === avatar.name) {
      onOpenChange(false);
      return;
    }

    renameAvatar.mutate(
      { id: avatar.id, data: { name: trimmed } },
      {
        onSuccess: () => {
          toast.success('Avatar renombrado.');
          onOpenChange(false);
        },
        onError: (err) => {
          toast.error(avatarErrorMessage(err, 'No se pudo renombrar el avatar.'));
        },
      },
    );
  };

  return (
    <Dialog open={!!avatar} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Renombrar avatar</DialogTitle>
          <DialogDescription>
            El nombre es lo único editable: la imagen de un avatar del catálogo no cambia.
          </DialogDescription>
        </DialogHeader>

        {avatar && (
          <div className="flex items-center gap-4">
            <CatalogAvatarTile avatar={avatar} className="w-24 shrink-0" />
            <div className="grid flex-1 gap-1.5">
              <FieldLabel htmlFor="avatar-name" className="text-on-surface">
                Nombre
              </FieldLabel>
              <Input
                id="avatar-name"
                value={name}
                maxLength={MAX_NAME}
                className="h-10"
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                }}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={renameAvatar.isPending}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={!canSubmit}>
            {renameAvatar.isPending && <Loader2 className="animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
