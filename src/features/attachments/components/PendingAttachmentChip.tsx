import { Loader2, X } from 'lucide-react';

import { AttachmentIcon } from './AttachmentIcon';
import type { PendingAttachment } from '../lib/pending-upload';

interface PendingAttachmentChipProps {
  slot: PendingAttachment;
  /** Quita el adjunto del composer (y, si ya subió, lo borra en el backend: lo decide el padre). */
  onRemove: () => void;
}

/**
 * (QL-174/QL-175) Miniatura (imágenes) o chip (archivos) de un adjunto **pendiente** de enviar,
 * con estado de subida y botón de quitar. Lo comparten el composer del Muro y el de comentarios
 * de tarea: es la vista previa de lo que se adjuntó —por el botón o **pegándolo**— antes de
 * publicar.
 */
export function PendingAttachmentChip({ slot, onRemove }: PendingAttachmentChipProps) {
  const uploading = slot.status === 'uploading';
  const error = slot.status === 'error';

  return (
    <div className="group/att relative flex items-center gap-2 rounded-md border border-outline-variant/40 bg-surface-container-low p-1 pr-2">
      {slot.isImage && slot.previewUrl ? (
        <span className="relative size-11 shrink-0 overflow-hidden rounded">
          <img src={slot.previewUrl} alt={slot.name} className="size-full object-cover" />
          {uploading && (
            <span className="absolute inset-0 flex items-center justify-center bg-surface/70">
              <Loader2 className="size-4 animate-spin text-primary" />
            </span>
          )}
        </span>
      ) : (
        <span className="flex size-9 shrink-0 items-center justify-center rounded bg-surface-container-high">
          {uploading ? (
            <Loader2 className="size-4 animate-spin text-on-surface-variant" />
          ) : (
            <AttachmentIcon mimeType={slot.isImage ? 'image/*' : 'application/octet-stream'} />
          )}
        </span>
      )}

      <div className="min-w-0 max-w-[9rem]">
        <p className="truncate text-xs font-medium text-on-surface" title={slot.name}>
          {slot.name}
        </p>
        <p className="text-[11px] text-on-surface-variant">
          {error ? 'Error' : uploading ? 'Subiendo…' : 'Listo'}
        </p>
      </div>

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Quitar ${slot.name}`}
        className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant transition-colors hover:bg-error-container hover:text-on-error-container"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
