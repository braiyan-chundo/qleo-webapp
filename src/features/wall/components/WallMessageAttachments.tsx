import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { Attachment } from '@/features/attachments/services/attachments.service';
import { AttachmentIcon } from '@/features/attachments/components/AttachmentIcon';
import { useDownloadAttachment } from '@/features/attachments/hooks/use-attachments';
import { formatFileSize, iconKindFor, notifyAttachmentError } from '@/features/attachments/lib/files';
import { AttachmentViewer } from '@/features/attachments/components/AttachmentViewer';

import { WallImage } from './WallImage';
import { WallVoicePlayer } from './WallVoicePlayer';
import { isAudioAttachment } from '../lib/wall-audio';

interface WallMessageAttachmentsProps {
  attachments: Attachment[];
}

/**
 * Adjuntos de un mensaje del muro (QL-90, §3.25.2). Las **imágenes** se muestran en línea
 * (`WallImage`, blob+token, lazy); las **notas de voz** (QL-104) como reproductor
 * (`WallVoicePlayer`); el resto como **chip**. (QL-168) Al hacer click en una imagen o en un chip
 * se abre el **visor** compartido (`AttachmentViewer`, QL-174) en vez de descargar; cada chip
 * conserva además un
 * botón explícito de **Descargar**. La descarga reusa el flujo blob+Bearer de
 * `features/attachments` (`useDownloadAttachment`), sin duplicar el fetch.
 */
export function WallMessageAttachments({ attachments }: WallMessageAttachmentsProps) {
  const download = useDownloadAttachment();
  // (QL-168) Adjunto abierto en el visor, o `null` si está cerrado.
  const [viewing, setViewing] = useState<Attachment | null>(null);

  if (attachments.length === 0) return null;

  const handleDownload = (attachment: Attachment) => {
    download.mutate(attachment, {
      onError: (err) => notifyAttachmentError(err, 'No se pudo descargar el archivo'),
    });
  };

  const audios = attachments.filter(isAudioAttachment);
  const images = attachments.filter(
    (a) => !isAudioAttachment(a) && iconKindFor(a.mimeType) === 'image',
  );
  const files = attachments.filter(
    (a) => !isAudioAttachment(a) && iconKindFor(a.mimeType) !== 'image',
  );

  return (
    <div className="mt-2 flex flex-col gap-2">
      {audios.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {audios.map((attachment) => (
            <WallVoicePlayer key={attachment.id} attachment={attachment} />
          ))}
        </div>
      )}

      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((attachment) => (
            <WallImage
              key={attachment.id}
              attachment={attachment}
              onOpen={() => setViewing(attachment)}
            />
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {files.map((attachment) => {
            const isDownloading =
              download.isPending && download.variables?.id === attachment.id;
            return (
              <div
                key={attachment.id}
                className="flex max-w-sm items-center gap-1 rounded-md border border-outline-variant/40 bg-surface-container-low pr-1.5"
              >
                {/* (QL-168) Click en el chip → abre el visor (no descarga). */}
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
        </div>
      )}

      <AttachmentViewer attachment={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}
