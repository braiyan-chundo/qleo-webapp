import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { Attachment } from '@/features/attachments/services/attachments.service';
import { AttachmentIcon } from '@/features/attachments/components/AttachmentIcon';
import { AttachmentViewer } from '@/features/attachments/components/AttachmentViewer';
import { useDownloadAttachment } from '@/features/attachments/hooks/use-attachments';
import { formatFileSize, notifyAttachmentError } from '@/features/attachments/lib/files';

interface CommentAttachmentsProps {
  attachments: Attachment[];
}

/**
 * (QL-174) Adjuntos de un comentario de tarea. Se pintan como **chips** compactos —el hilo de
 * comentarios es una columna estrecha y una galería en línea lo rompería—: click en el chip abre
 * el **visor compartido** (`AttachmentViewer`: imagen, vídeo, PDF, md/txt y, si no, descarga) y
 * el botón de la derecha descarga directamente con el flujo blob+Bearer.
 */
export function CommentAttachments({ attachments }: CommentAttachmentsProps) {
  const download = useDownloadAttachment();
  const [viewing, setViewing] = useState<Attachment | null>(null);

  if (attachments.length === 0) return null;

  const handleDownload = (attachment: Attachment) => {
    download.mutate(attachment, {
      onError: (err) => notifyAttachmentError(err, 'No se pudo descargar el archivo'),
    });
  };

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      {attachments.map((attachment) => {
        const isDownloading =
          download.isPending && download.variables?.id === attachment.id;
        return (
          <div
            key={attachment.id}
            className="flex max-w-sm items-center gap-1 rounded-md border border-outline-variant/40 bg-surface-container-low pr-1.5"
          >
            <button
              type="button"
              onClick={() => setViewing(attachment)}
              title={`Ver ${attachment.originalName}`}
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left transition-colors hover:bg-surface-container"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-container-high">
                <AttachmentIcon mimeType={attachment.mimeType} />
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-sm font-medium text-on-surface"
                  title={attachment.originalName}
                >
                  {attachment.originalName}
                </p>
                <p className="text-xs tabular-nums text-on-surface-variant">
                  {formatFileSize(attachment.size)}
                </p>
              </div>
            </button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              onClick={() => handleDownload(attachment)}
              disabled={isDownloading}
              aria-label={`Descargar ${attachment.originalName}`}
            >
              {isDownloading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
            </Button>
          </div>
        );
      })}

      <AttachmentViewer attachment={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}
