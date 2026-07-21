import { useEffect, useState } from 'react';
import { Download, FileQuestion, Loader2, TriangleAlert } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { Attachment } from '@/features/attachments/services/attachments.service';
import { useDownloadAttachment } from '@/features/attachments/hooks/use-attachments';
import { formatFileSize, notifyAttachmentError } from '@/features/attachments/lib/files';

import { useWallImage } from '../hooks/use-wall-image';

/**
 * Visor de adjuntos del Muro (QL-168, §3.25.2). Al hacer click en un adjunto de un mensaje se
 * abre este visor **en vez de descargar**: previsualiza imagen, vídeo, PDF, Markdown y texto;
 * cualquier otro formato muestra "No se puede previsualizar" + descarga. Siempre ofrece además
 * un botón de **Descargar**.
 *
 * El binario es privado (`GET /attachments/:id/download` requiere `Authorization: Bearer`), así
 * que NO se puede usar `<img src>`/`<iframe src>` directo con `downloadUrl`. Se reutiliza
 * `useWallImage` (mismo patrón que `WallImage`): baja el binario autenticado, lo cachea por
 * `downloadUrl` como `blob:` URL y lo **revoca** al salir de la caché (evita fugas de memoria).
 * Para Markdown/texto se lee ese `blob:` local con `fetch().text()` (sin segunda descarga
 * autenticada). No hay renderer de Markdown en el repo → se muestra el texto crudo en `<pre>`.
 */

type PreviewKind = 'image' | 'video' | 'pdf' | 'markdown' | 'text' | 'unsupported';

/** Deriva el tipo de previsualización desde el MIME y, como respaldo, la extensión del nombre. */
function previewKindFor(attachment: Attachment): PreviewKind {
  const mime = attachment.mimeType?.toLowerCase() ?? '';
  const name = attachment.originalName?.toLowerCase() ?? '';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (mime === 'text/markdown' || name.endsWith('.md') || name.endsWith('.markdown')) {
    return 'markdown';
  }
  if (mime === 'text/plain' || mime.startsWith('text/') || name.endsWith('.txt')) {
    return 'text';
  }
  return 'unsupported';
}

/** Etiqueta corta del tipo, para el subtítulo del visor. */
function kindLabel(kind: PreviewKind, mimeType: string): string {
  switch (kind) {
    case 'image':
      return 'Imagen';
    case 'video':
      return 'Vídeo';
    case 'pdf':
      return 'PDF';
    case 'markdown':
      return 'Markdown';
    case 'text':
      return 'Texto';
    default:
      return mimeType || 'Archivo';
  }
}

interface WallAttachmentViewerProps {
  /** Adjunto a previsualizar; `null` = visor cerrado (el componente vive montado siempre). */
  attachment: Attachment | null;
  /** Cierra el visor (Escape / backdrop / botón). */
  onClose: () => void;
}

export function WallAttachmentViewer({ attachment, onClose }: WallAttachmentViewerProps) {
  const open = attachment != null;
  const kind = attachment ? previewKindFor(attachment) : 'unsupported';
  const needsBlob = open && kind !== 'unsupported';

  // Descarga autenticada + caché + revocación del `blob:` URL (reutiliza el patrón de imágenes).
  const {
    data: blobUrl,
    isLoading,
    isError,
  } = useWallImage(attachment?.downloadUrl, needsBlob);

  // Markdown/texto: se leen del `blob:` local (ya autenticado y cacheado) a texto plano.
  const needsText = kind === 'markdown' || kind === 'text';
  const [text, setText] = useState<string | null>(null);
  const [textError, setTextError] = useState(false);

  useEffect(() => {
    if (!needsText || !blobUrl) {
      setText(null);
      setTextError(false);
      return;
    }
    let cancelled = false;
    setText(null);
    setTextError(false);
    fetch(blobUrl)
      .then((res) => res.text())
      .then((content) => {
        if (!cancelled) setText(content);
      })
      .catch(() => {
        if (!cancelled) setTextError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [needsText, blobUrl]);

  const download = useDownloadAttachment();
  const isDownloading = download.isPending;

  const handleDownload = () => {
    if (!attachment) return;
    download.mutate(attachment, {
      onError: (err) => notifyAttachmentError(err, 'No se pudo descargar el archivo'),
    });
  };

  const loading = (
    <div className="flex h-64 items-center justify-center text-on-surface-variant">
      <Loader2 className="size-6 animate-spin" />
    </div>
  );

  const failed = (
    <div className="flex h-64 flex-col items-center justify-center gap-2 text-on-surface-variant">
      <TriangleAlert className="size-8" />
      <p className="text-sm">No se pudo cargar el archivo.</p>
    </div>
  );

  function renderBody() {
    if (!attachment) return null;

    if (kind === 'unsupported') {
      return (
        <div className="flex h-64 flex-col items-center justify-center gap-3 px-6 text-center text-on-surface-variant">
          <FileQuestion className="size-10" />
          <p className="text-sm">No se puede previsualizar este formato.</p>
          <Button type="button" onClick={handleDownload} disabled={isDownloading}>
            {isDownloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Descargar
          </Button>
        </div>
      );
    }

    if (isError) return failed;
    if (isLoading || !blobUrl) return loading;

    switch (kind) {
      case 'image':
        return (
          <img
            src={blobUrl}
            alt={attachment.originalName}
            className="mx-auto max-h-[70vh] w-auto max-w-full object-contain"
          />
        );
      case 'video':
        return (
          <video
            src={blobUrl}
            controls
            className="mx-auto max-h-[70vh] w-full"
            aria-label={attachment.originalName}
          />
        );
      case 'pdf':
        return (
          <iframe
            src={blobUrl}
            title={attachment.originalName}
            className="h-[70vh] w-full border-0"
          />
        );
      case 'markdown':
      case 'text':
        if (textError) return failed;
        if (text == null) return loading;
        return (
          <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-words p-4 text-sm text-on-surface">
            {text}
          </pre>
        );
      default:
        return null;
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-h-[92vh] gap-3 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-8" title={attachment?.originalName}>
            {attachment?.originalName ?? 'Adjunto'}
          </DialogTitle>
          <DialogDescription>
            {attachment
              ? `${kindLabel(kind, attachment.mimeType)} · ${formatFileSize(attachment.size)}`
              : null}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-hidden rounded-lg border border-outline-variant/40 bg-surface-container-low">
          {renderBody()}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          <Button type="button" onClick={handleDownload} disabled={isDownloading}>
            {isDownloading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Descargar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
