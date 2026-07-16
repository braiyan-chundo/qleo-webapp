import { useRef } from 'react';
import { toast } from 'sonner';
import { FileText, Loader2, Upload } from 'lucide-react';

import type { Project } from '@/features/projects/types/project';
import { canManageProject } from '@/features/projects/utils/permissions';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import type { Attachment } from '../services/attachments.service';
import {
  useDeleteProjectAttachment,
  useDownloadAttachment,
  useProjectAttachments,
  useUploadProjectAttachment,
} from '../hooks/use-attachments';
import {
  ACCEPT_ATTR,
  notifyAttachmentError,
  validateFile,
} from '../lib/files';
import { AttachmentListItem } from './AttachmentListItem';

interface ProjectDocumentsPanelProps {
  project: Pick<Project, 'id' | 'createdBy' | 'managerIds'>;
}

/**
 * Pestaña "Documentos" del proyecto (QL-41, §3.18): adjuntos **generales** del proyecto
 * (`scope='project'`), no ligados a una tarea. Reusa el mismo objeto `Attachment`, la fila
 * visual (`AttachmentListItem`) y la descarga con token que los adjuntos de tarea.
 *
 * Gate de UI (cosmético; el backend valida igual):
 * - `canManageProject` (ADMIN, creador o **gestor** otorgado) → muestra la zona de subida.
 *   Es la regla que aplica el backend: `attachments.service` llama a `assertCanManageProject`
 *   tanto al subir como al borrar, así que un gestor está autorizado en ambas (QL-131).
 * - Botón "Borrar" por doc → `canManage || doc.uploadedBy.id === user.id` (el autor siempre
 *   puede borrar el suyo).
 */
export function ProjectDocumentsPanel({ project }: ProjectDocumentsPanelProps) {
  const user = useAuthStore((s) => s.user);
  const canManage = canManageProject(project, user);

  const { data: docs, isLoading, isError, error } = useProjectAttachments(project.id);
  const uploadDoc = useUploadProjectAttachment(project.id);
  const deleteDoc = useDeleteProjectAttachment(project.id);
  const downloadDoc = useDownloadAttachment();

  const inputRef = useRef<HTMLInputElement>(null);

  const total = docs?.length ?? 0;

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

    uploadDoc.mutate(file, {
      onSuccess: () => toast.success('Documento subido'),
      onError: (err) => notifyAttachmentError(err, 'No se pudo subir el documento'),
    });
  };

  const handleDownload = (doc: Attachment) => {
    downloadDoc.mutate(doc, {
      onError: (err) => notifyAttachmentError(err, 'No se pudo descargar el documento'),
    });
  };

  const handleDelete = (doc: Attachment) => {
    deleteDoc.mutate(doc.id, {
      onSuccess: () => toast.success('Documento eliminado'),
      onError: (err) => notifyAttachmentError(err, 'No se pudo eliminar el documento'),
    });
  };

  return (
    <div className="mt-4 max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-on-surface-variant" />
          <div>
            <p className="text-sm font-medium text-on-surface">Documentos del proyecto</p>
            <p className="text-xs text-on-surface-variant">
              Archivos generales del proyecto (cotizaciones, contratos, informes…).
            </p>
          </div>
        </div>

        {canManage && (
          <div className="shrink-0">
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT_ATTR}
              className="hidden"
              onChange={handleFilePicked}
              disabled={uploadDoc.isPending}
            />
            <Button
              type="button"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={uploadDoc.isPending}
            >
              {uploadDoc.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Upload />
              )}
              Subir documento
            </Button>
          </div>
        )}
      </div>

      {canManage && (
        <p className="mt-2 text-xs text-on-surface-variant">
          Máx. 10 MB · PDF, imágenes, Office, texto o ZIP.
        </p>
      )}

      {isLoading && (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-12 w-full rounded-md" />
          <Skeleton className="h-12 w-5/6 rounded-md" />
          <Skeleton className="h-12 w-2/3 rounded-md" />
        </div>
      )}

      {isError && (
        <p className="mt-4 rounded-md border border-error/20 bg-error-container px-3 py-2 text-xs font-medium text-on-error-container">
          {error instanceof Error ? error.message : 'No se pudieron cargar los documentos'}
        </p>
      )}

      {!isLoading && !isError && total === 0 && (
        <div className="mt-4 rounded-lg border border-dashed border-outline-variant/60 bg-surface-container-lowest px-4 py-10 text-center">
          <FileText className="mx-auto size-6 text-on-surface-variant" />
          <p className="mt-2 text-sm font-medium text-on-surface">
            Aún no hay documentos
          </p>
          <p className="mt-1 text-xs text-on-surface-variant">
            {canManage
              ? 'Sube el primer documento del proyecto.'
              : 'Cuando se suba un documento aparecerá aquí.'}
          </p>
        </div>
      )}

      {!isLoading && !isError && docs && total > 0 && (
        <ul className="mt-4 space-y-2">
          {docs.map((doc) => {
            const canDelete = canManage || doc.uploadedBy.id === user?.id;
            return (
              <AttachmentListItem
                key={doc.id}
                attachment={doc}
                canDelete={canDelete}
                downloading={
                  downloadDoc.isPending && downloadDoc.variables?.id === doc.id
                }
                deleting={deleteDoc.isPending && deleteDoc.variables === doc.id}
                onDownload={() => handleDownload(doc)}
                onDelete={() => handleDelete(doc)}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}
