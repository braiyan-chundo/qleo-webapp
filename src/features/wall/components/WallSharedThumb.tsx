import { ImageOff, Loader2, Trash2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { Attachment } from '@/features/attachments/services/attachments.service';
import { useAttachmentBlob } from '@/features/attachments/hooks/use-attachment-blob';

interface WallSharedThumbProps {
  attachment: Attachment;
  /** Click en la miniatura → descarga con el flujo blob+Bearer (mismo que el feed). */
  onOpen: () => void;
  /**
   * (QL-136) Si se pasa, la miniatura muestra el botón de **eliminar**. El llamador decide si
   * el usuario puede (ADMIN o autor) y se encarga de confirmar antes de borrar.
   */
  onDelete?: () => void;
  /** (QL-136) `true` mientras se borra este adjunto: bloquea el botón y muestra el spinner. */
  deleting?: boolean;
}

/**
 * Miniatura cuadrada de una imagen de la galería "Archivos compartidos" (QL-96, §3.28). El
 * binario es privado (`downloadUrl` requiere Bearer), así que se baja con `useAttachmentBlob`
 * (fetch+blob, cacheado por URL). La galería es acotada (≤12 items visibles), por eso se
 * carga directamente (`enabled=true`) sin `IntersectionObserver`, a diferencia de `WallImage`.
 *
 * El borrado (QL-136) va en un botón **hermano**, no anidado: un `<button>` dentro de otro es
 * HTML inválido. Por eso la raíz es un `<div>` y la miniatura y la papelera son dos botones
 * dentro. La papelera es **siempre visible** (no solo al hover): igual que el ⋮ de las burbujas
 * (QL-108), un affordance solo-hover es inalcanzable al tacto.
 */
export function WallSharedThumb({
  attachment,
  onOpen,
  onDelete,
  deleting = false,
}: WallSharedThumbProps) {
  const {
    data: blobUrl,
    isLoading,
    isError,
  } = useAttachmentBlob(attachment.downloadUrl, true);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onOpen}
        title={attachment.originalName}
        aria-label={`Abrir imagen ${attachment.originalName}`}
        className={cn(
          'relative block aspect-square w-full overflow-hidden rounded-lg border border-outline-variant/40 bg-surface-container-low',
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

      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          aria-label={`Eliminar ${attachment.originalName}`}
          className={cn(
            'absolute right-1 top-1 flex size-6 items-center justify-center rounded-full',
            'bg-surface-container-highest/90 text-on-surface-variant transition-colors',
            'hover:bg-error-container hover:text-on-error-container disabled:opacity-60',
          )}
        >
          {deleting ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Trash2 className="size-3" />
          )}
        </button>
      )}
    </div>
  );
}
