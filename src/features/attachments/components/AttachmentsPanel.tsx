import { useRef } from 'react';
import { toast } from 'sonner';
import { Loader2, Paperclip, Upload } from 'lucide-react';

import type { TaskRole } from '@/features/tasks/services/tasks.service';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import type { Attachment } from '../services/attachments.service';
import {
  useAttachments,
  useDeleteAttachment,
  useDownloadAttachment,
  useUploadAttachment,
} from '../hooks/use-attachments';
import {
  ACCEPT_ATTR,
  notifyAttachmentError,
  validateFile,
} from '../lib/files';
import { AttachmentListItem } from './AttachmentListItem';

interface AttachmentsPanelProps {
  task: { id: string; currentUserRole: TaskRole | null };
}

/**
 * Panel de adjuntos dentro del detalle de tarea (QL-14, §3.11). Deriva `canUpload` del rol
 * por tarea (CREATOR/ASSIGNEE/COLLABORATOR) y solo pinta el botón de borrar cuando el usuario
 * es el **autor** del adjunto o el **CREATOR** de la tarea, sin ofrecer controles que darían 403.
 * La descarga usa el helper con token (fetch → blob) porque el binario no es público.
 */
export function AttachmentsPanel({ task }: AttachmentsPanelProps) {
  const role = task.currentUserRole;
  const isCreator = role === 'CREATOR';
  const canUpload =
    role === 'CREATOR' || role === 'ASSIGNEE' || role === 'COLLABORATOR';
  const currentUserId = useAuthStore((s) => s.user?.id);

  const { data: attachments, isLoading, isError, error } = useAttachments(task.id);
  const uploadAttachment = useUploadAttachment(task.id);
  const deleteAttachment = useDeleteAttachment(task.id);
  const downloadAttachment = useDownloadAttachment();

  const inputRef = useRef<HTMLInputElement>(null);

  const total = attachments?.length ?? 0;

  const handleFilePicked = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Permite volver a elegir el mismo archivo después (el input recuerda el último value).
    event.target.value = '';
    if (!file) return;

    // Validación previa (feedback inmediato); el backend sigue siendo la fuente de verdad.
    const invalid = validateFile(file);
    if (invalid) {
      toast.error(invalid.message);
      return;
    }

    uploadAttachment.mutate(file, {
      onSuccess: () => toast.success('Archivo subido'),
      onError: (err) => notifyAttachmentError(err, 'No se pudo subir el archivo'),
    });
  };

  const handleDownload = (attachment: Attachment) => {
    downloadAttachment.mutate(attachment, {
      onError: (err) => notifyAttachmentError(err, 'No se pudo descargar el archivo'),
    });
  };

  const handleDelete = (attachment: Attachment) => {
    deleteAttachment.mutate(attachment.id, {
      onSuccess: () => toast.success('Archivo eliminado'),
      onError: (err) => notifyAttachmentError(err, 'No se pudo eliminar el archivo'),
    });
  };

  return (
    <div className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-4 py-3">
      <div className="flex items-center gap-2">
        <Paperclip className="size-4 text-on-surface-variant" />
        <p className="text-xs font-medium text-on-surface-variant">Adjuntos</p>
        {total > 0 && (
          <span className="ml-auto text-xs font-medium tabular-nums text-on-surface-variant">
            {total}
          </span>
        )}
      </div>

      {isLoading && (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-12 w-full rounded-md" />
          <Skeleton className="h-12 w-5/6 rounded-md" />
        </div>
      )}

      {isError && (
        <p className="mt-3 rounded-md border border-error/20 bg-error-container px-3 py-2 text-xs font-medium text-on-error-container">
          {error instanceof Error ? error.message : 'No se pudieron cargar los adjuntos'}
        </p>
      )}

      {!isLoading && !isError && total === 0 && (
        <p className="mt-3 text-sm text-on-surface-variant">
          {canUpload ? 'Sube el primer archivo.' : 'Aún no hay archivos adjuntos.'}
        </p>
      )}

      {!isLoading && !isError && attachments && total > 0 && (
        <ul className="mt-3 space-y-2">
          {attachments.map((attachment) => {
            const canDelete =
              isCreator ||
              (!!currentUserId && attachment.uploadedBy.id === currentUserId);
            return (
              <AttachmentListItem
                key={attachment.id}
                attachment={attachment}
                canDelete={canDelete}
                downloading={
                  downloadAttachment.isPending &&
                  downloadAttachment.variables?.id === attachment.id
                }
                deleting={
                  deleteAttachment.isPending &&
                  deleteAttachment.variables === attachment.id
                }
                onDownload={() => handleDownload(attachment)}
                onDelete={() => handleDelete(attachment)}
              />
            );
          })}
        </ul>
      )}

      {canUpload && !isError && (
        <div className="mt-4">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_ATTR}
            className="hidden"
            onChange={handleFilePicked}
            disabled={uploadAttachment.isPending}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploadAttachment.isPending}
          >
            {uploadAttachment.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Upload />
            )}
            Subir archivo
          </Button>
          <p className="mt-2 text-xs text-on-surface-variant">
            Máx. 10 MB · PDF, imágenes, Office, texto o ZIP.
          </p>
        </div>
      )}

      {!canUpload && role === 'OBSERVER' && !isError && (
        <p className="mt-3 text-xs text-on-surface-variant">
          Tu rol es de solo lectura.
        </p>
      )}
    </div>
  );
}
