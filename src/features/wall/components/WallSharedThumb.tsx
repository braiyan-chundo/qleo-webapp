import { ImageOff, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { Attachment } from '@/features/attachments/services/attachments.service';

import { useWallImage } from '../hooks/use-wall-image';

interface WallSharedThumbProps {
  attachment: Attachment;
  /** Click en la miniatura → descarga con el flujo blob+Bearer (mismo que el feed). */
  onOpen: () => void;
}

/**
 * Miniatura cuadrada de una imagen de la galería "Archivos compartidos" (QL-96, §3.28). El
 * binario es privado (`downloadUrl` requiere Bearer), así que se baja con `useWallImage`
 * (fetch+blob, cacheado por URL). La galería es acotada (≤12 items visibles), por eso se
 * carga directamente (`enabled=true`) sin `IntersectionObserver`, a diferencia de `WallImage`.
 */
export function WallSharedThumb({ attachment, onOpen }: WallSharedThumbProps) {
  const { data: blobUrl, isLoading, isError } = useWallImage(attachment.downloadUrl, true);

  return (
    <button
      type="button"
      onClick={onOpen}
      title={attachment.originalName}
      aria-label={`Abrir imagen ${attachment.originalName}`}
      className={cn(
        'relative aspect-square overflow-hidden rounded-lg border border-outline-variant/40 bg-surface-container-low',
        'transition-opacity hover:opacity-90',
      )}
    >
      {blobUrl && !isError ? (
        <img
          src={blobUrl}
          alt={attachment.originalName}
          loading="lazy"
          className="size-full object-cover"
        />
      ) : (
        <span className="flex size-full items-center justify-center text-on-surface-variant">
          {isError ? (
            <ImageOff className="size-4" />
          ) : isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ImageOff className="size-4 opacity-40" />
          )}
        </span>
      )}
    </button>
  );
}
