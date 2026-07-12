import { useEffect, useRef, useState } from 'react';
import { ImageOff, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { Attachment } from '@/features/attachments/services/attachments.service';
import { useWallImage } from '../hooks/use-wall-image';

interface WallImageProps {
  attachment: Attachment;
  /** Click en la imagen → descarga con el flujo blob+Bearer (mismo que los archivos). */
  onOpen: () => void;
}

/**
 * Imagen adjunta renderizada **en línea** en el hilo del muro (QL-90). El binario es privado
 * (`downloadUrl` requiere Bearer), así que se baja con `useWallImage` (fetch+blob) y solo
 * **cuando entra en el viewport** (`IntersectionObserver` → carga perezosa). El tamaño está
 * acotado (`max-w`/`max-h`) para no romper el layout del chat.
 */
export function WallImage({ attachment, onOpen }: WallImageProps) {
  const containerRef = useRef<HTMLButtonElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || inView) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '150px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [inView]);

  const { data: blobUrl, isLoading, isError } = useWallImage(attachment.downloadUrl, inView);

  return (
    <button
      ref={containerRef}
      type="button"
      onClick={onOpen}
      title={attachment.originalName}
      aria-label={`Abrir imagen ${attachment.originalName}`}
      className={cn(
        'group/img relative flex max-h-64 max-w-xs items-center justify-center overflow-hidden rounded-lg border border-outline-variant/40 bg-surface-container-low',
        'transition-opacity hover:opacity-95',
      )}
    >
      {blobUrl && !isError ? (
        <img
          src={blobUrl}
          alt={attachment.originalName}
          loading="lazy"
          className="max-h-64 max-w-full object-contain"
        />
      ) : isError ? (
        <span className="flex h-32 w-40 flex-col items-center justify-center gap-1 text-on-surface-variant">
          <ImageOff className="size-6" />
          <span className="text-xs">No se pudo cargar</span>
        </span>
      ) : (
        <span className="flex h-32 w-40 items-center justify-center text-on-surface-variant">
          {isLoading || inView ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <ImageOff className="size-5 opacity-40" />
          )}
        </span>
      )}
    </button>
  );
}
