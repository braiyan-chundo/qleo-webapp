import { cn } from '@/lib/utils';
import { AuthedAvatar, identityAvatarFallback } from '@/shared/components/AuthedAvatar';

import type { CatalogAvatar } from '../services/avatars.service';

interface CatalogAvatarTileProps {
  avatar: CatalogAvatar;
  /** Marca visual de "es el que tengo puesto" (`user.avatarCatalogId`). */
  selected?: boolean;
  className?: string;
}

/**
 * (QL-181, §3.59) Ficha de un avatar del catálogo: imagen + nombre. Fuente única de la rejilla,
 * compartida por el panel de ADMIN y por el selector del perfil.
 *
 * El binario (`/avatars/:id/image`) va tras `Authorization: Bearer`, así que **no** se puede
 * pintar con un `<img src>` desnudo: se delega en `AuthedAvatar`, que ya hace el fetch con token,
 * cachea el `blob:` por URL y revoca al expirar (misma capa que los avatares de usuario).
 */
export function CatalogAvatarTile({
  avatar,
  selected = false,
  className,
}: CatalogAvatarTileProps) {
  return (
    <div className={cn('flex min-w-0 flex-col items-center gap-1.5', className)}>
      <AuthedAvatar
        size="lg"
        className={cn(
          'size-16 border transition-colors',
          selected
            ? 'border-primary ring-2 ring-primary/40'
            : 'border-outline-variant/50',
        )}
        avatarDownloadUrl={avatar.downloadUrl}
        name={avatar.name}
        fallbackClassName={`${identityAvatarFallback} text-lg`}
      />
      <span
        className="w-full truncate text-center text-xs text-on-surface-variant"
        title={avatar.name}
      >
        {avatar.name}
      </span>
    </div>
  );
}
