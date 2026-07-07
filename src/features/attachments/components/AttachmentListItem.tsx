import { useEffect, useRef, useState } from 'react';
import { Download, Loader2, Trash2 } from 'lucide-react';

import { AuthedAvatar } from '@/shared/components/AuthedAvatar';
import { Button } from '@/components/ui/button';
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

import type { Attachment } from '../services/attachments.service';
import { formatFileSize, timeAgo } from '../lib/files';
import { AttachmentIcon } from './AttachmentIcon';

interface AttachmentListItemProps {
  attachment: Attachment;
  canDelete: boolean;
  downloading: boolean;
  deleting: boolean;
  onDownload: () => void;
  onDelete: () => void;
}

/**
 * Fila reutilizable de adjunto/documento (§3.11 y §3.18): icono por tipo, nombre, tamaño,
 * autor (`AuthedAvatar`) + fecha, descargar y borrar. Es presentacional: el borrado y la
 * descarga se disparan por callbacks, así el mismo componente sirve para adjuntos de tarea
 * y documentos de proyecto (cada panel usa su propia mutación/key de invalidación).
 */
export function AttachmentListItem({
  attachment,
  canDelete,
  downloading,
  deleting,
  onDownload,
  onDelete,
}: AttachmentListItemProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const uploaderName = attachment.uploadedBy.name || 'Usuario';

  // Cierra el diálogo al terminar el borrado: en éxito la fila se desmonta (lista invalidada);
  // en error queda montada y el `deleting` true→false la cierra.
  const wasDeleting = useRef(false);
  useEffect(() => {
    if (wasDeleting.current && !deleting) setConfirmDelete(false);
    wasDeleting.current = deleting;
  }, [deleting]);

  return (
    <li className="flex items-center gap-3 rounded-md border border-outline-variant/40 bg-surface-container-low px-3 py-2">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-container-high">
        <AttachmentIcon mimeType={attachment.mimeType} />
      </span>

      <div className="min-w-0 flex-1">
        <p
          className="truncate text-sm font-medium text-on-surface"
          title={attachment.originalName}
        >
          {attachment.originalName}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-on-surface-variant">
          <span className="tabular-nums">{formatFileSize(attachment.size)}</span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1">
            <AuthedAvatar
              size="sm"
              className="size-4"
              avatarDownloadUrl={attachment.uploadedBy.avatarDownloadUrl}
              avatarUrl={attachment.uploadedBy.avatarUrl}
              name={uploaderName}
              fallbackClassName="text-[9px]"
            />
            {uploaderName}
          </span>
          <span aria-hidden>·</span>
          <span>{timeAgo(attachment.createdAt)}</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={onDownload}
          disabled={downloading}
          aria-label={`Descargar ${attachment.originalName}`}
        >
          {downloading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
        </Button>
        {canDelete && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-error hover:text-error"
            onClick={() => setConfirmDelete(true)}
            aria-label={`Eliminar ${attachment.originalName}`}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>

      <AlertDialog
        open={confirmDelete}
        onOpenChange={(o) => {
          if (!o) setConfirmDelete(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar archivo</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Seguro que quieres eliminar{' '}
              <span className="font-medium text-on-surface">
                {attachment.originalName}
              </span>
              ? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault();
                onDelete();
              }}
              disabled={deleting}
            >
              {deleting && <Loader2 className="animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
