import { useCallback, useState } from 'react';
import { Download, ExternalLink, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { UseQueryResult } from '@tanstack/react-query';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
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
import { useAuthStore } from '@/store/auth.store';
import type { Attachment } from '@/features/attachments/services/attachments.service';
import { AttachmentIcon } from '@/features/attachments/components/AttachmentIcon';
import { useDownloadAttachment } from '@/features/attachments/hooks/use-attachments';
import { formatFileSize, notifyAttachmentError } from '@/features/attachments/lib/files';

import { formatWallShortDate } from '../lib/wall-dates';
import { canDeleteWallAttachment } from '../lib/wall-attachments';
import { useDeleteSharedAttachment } from '../hooks/use-wall-shared';
import {
  sharedAttachments,
  sharedLinks,
  type WallLinkItem,
  type WallSharedResponse,
  type WallSharedType,
} from '../types/wall-shared.types';
import { WallSharedThumb } from './WallSharedThumb';

interface WallSharedContentProps {
  type: WallSharedType;
  query: UseQueryResult<WallSharedResponse>;
  /** Nº de items del esqueleto de carga (el panel es más pequeño que el modal). */
  skeletonCount?: number;
}

/** Predicado de permiso por adjunto; lo calcula el contenedor una vez y lo bajan las listas. */
type CanDelete = (attachment: Attachment) => boolean;

/**
 * Cuerpo de la galería "Archivos compartidos" (QL-96, §3.28) para un `type` dado, con el
 * **borrado de adjuntos** de QL-136 (§3.35). Posee el estado de confirmación y **un único**
 * `AlertDialog` para toda la galería (no uno por item), y baja a las listas el permiso ya
 * resuelto. Se reutiliza tal cual en el panel del aside y en el modal "Ver todos".
 *
 * `links` NO tiene borrado: no son ficheros, se derivan del `body` del mensaje y desaparecen
 * solos cuando el mensaje se borra (§3.35).
 */
export function WallSharedContent({ type, query, skeletonCount = 6 }: WallSharedContentProps) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const deleteAttachment = useDeleteSharedAttachment();
  const [target, setTarget] = useState<Attachment | null>(null);

  const canDelete = useCallback<CanDelete>(
    (attachment) => canDeleteWallAttachment(attachment, currentUserId, isAdmin),
    [currentUserId, isAdmin],
  );

  // Id en vuelo (para el spinner del item concreto, no de toda la galería).
  const deletingId = deleteAttachment.isPending ? deleteAttachment.variables?.id : undefined;

  const handleConfirm = () => {
    if (!target) return;
    deleteAttachment.mutate(target, {
      onSuccess: () => {
        setTarget(null);
        toast.success('Archivo eliminado');
      },
      onError: (err) => {
        setTarget(null);
        // El endpoint es de adjuntos (§3.11/§3.18): 403 si no eres ADMIN ni el autor, 404 si
        // ya no existe. Ambos caen al mensaje del backend, que ya es explícito.
        notifyAttachmentError(err, 'No se pudo eliminar el archivo');
      },
    });
  };

  return (
    <>
      <SharedBody
        type={type}
        query={query}
        skeletonCount={skeletonCount}
        canDelete={canDelete}
        onRequestDelete={setTarget}
        deletingId={deletingId}
      />

      <AlertDialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open && !deleteAttachment.isPending) setTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar archivo</AlertDialogTitle>
            <AlertDialogDescription>
              {target
                ? `«${target.originalName}» se borrará definitivamente del almacenamiento. Si era el único contenido de su mensaje, el mensaje quedará como eliminado. Esta acción no se puede deshacer.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteAttachment.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault();
                handleConfirm();
              }}
              disabled={deleteAttachment.isPending}
            >
              {deleteAttachment.isPending && <Loader2 className="animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface SharedBodyProps extends WallSharedContentProps {
  canDelete: CanDelete;
  onRequestDelete: (attachment: Attachment) => void;
  deletingId: string | undefined;
}

/** Pinta la cuadrícula (`media`), los chips (`docs`) o los enlaces (`links`) + loading/error/empty. */
function SharedBody({
  type,
  query,
  skeletonCount = 6,
  canDelete,
  onRequestDelete,
  deletingId,
}: SharedBodyProps) {
  const { data, isLoading, isError } = query;

  if (isLoading) return <SharedSkeleton type={type} count={skeletonCount} />;

  if (isError) {
    return (
      <p className="px-1 py-2 text-xs text-on-surface-variant">
        No se pudieron cargar los archivos.
      </p>
    );
  }

  if (type === 'links') {
    const links = sharedLinks(data);
    if (links.length === 0) return <SharedEmpty label="Aún no hay enlaces" />;
    return <SharedLinksList links={links} />;
  }

  const attachments = sharedAttachments(data);
  if (attachments.length === 0) return <SharedEmpty label="Aún no hay archivos" />;

  return type === 'media' ? (
    <SharedMediaGrid
      items={attachments}
      canDelete={canDelete}
      onRequestDelete={onRequestDelete}
      deletingId={deletingId}
    />
  ) : (
    <SharedDocsList
      items={attachments}
      canDelete={canDelete}
      onRequestDelete={onRequestDelete}
      deletingId={deletingId}
    />
  );
}

interface SharedListProps {
  items: Attachment[];
  canDelete: CanDelete;
  onRequestDelete: (attachment: Attachment) => void;
  deletingId: string | undefined;
}

/** Cuadrícula de miniaturas; click descarga la imagen (blob+Bearer), papelera pide confirmar. */
function SharedMediaGrid({ items, canDelete, onRequestDelete, deletingId }: SharedListProps) {
  const download = useDownloadAttachment();

  const handleOpen = (attachment: Attachment) => {
    download.mutate(attachment, {
      onError: (err) => notifyAttachmentError(err, 'No se pudo abrir la imagen'),
    });
  };

  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((attachment) => (
        <WallSharedThumb
          key={attachment.id}
          attachment={attachment}
          onOpen={() => handleOpen(attachment)}
          onDelete={canDelete(attachment) ? () => onRequestDelete(attachment) : undefined}
          deleting={deletingId === attachment.id}
        />
      ))}
    </div>
  );
}

/** Lista de chips (icono + nombre + tamaño) descargables (blob+Bearer) + papelera si procede. */
function SharedDocsList({ items, canDelete, onRequestDelete, deletingId }: SharedListProps) {
  const download = useDownloadAttachment();

  const handleDownload = (attachment: Attachment) => {
    download.mutate(attachment, {
      onError: (err) => notifyAttachmentError(err, 'No se pudo descargar el archivo'),
    });
  };

  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((attachment) => {
        const isDownloading =
          download.isPending && download.variables?.id === attachment.id;
        const isDeleting = deletingId === attachment.id;
        return (
          <li key={attachment.id} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleDownload(attachment)}
              disabled={isDownloading || isDeleting}
              aria-label={`Descargar ${attachment.originalName}`}
              className={cn(
                'flex min-w-0 flex-1 items-center gap-2.5 rounded-md border border-outline-variant/40 bg-surface-container-low px-2.5 py-1.5 text-left',
                'transition-colors hover:border-outline-variant hover:bg-surface-container disabled:opacity-60',
              )}
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
              {isDownloading ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-on-surface-variant" />
              ) : (
                <Download className="size-4 shrink-0 text-on-surface-variant" />
              )}
            </button>

            {/* (QL-136) Hermano del chip, nunca anidado: un <button> dentro de otro es HTML
                inválido. Siempre visible (accesible al tacto), como el ⋮ de las burbujas. */}
            {canDelete(attachment) && (
              <button
                type="button"
                onClick={() => onRequestDelete(attachment)}
                disabled={isDeleting}
                aria-label={`Eliminar ${attachment.originalName}`}
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-md text-on-surface-variant',
                  'transition-colors hover:bg-error-container hover:text-on-error-container disabled:opacity-60',
                )}
              >
                {isDeleting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Lista de enlaces: abre en nueva pestaña (`rel="noopener noreferrer"`) + autor/fecha. */
function SharedLinksList({ links }: { links: WallLinkItem[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {links.map((link, index) => (
        <li key={`${link.wallMessageId}-${index}`}>
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'flex items-start gap-2.5 rounded-md border border-outline-variant/40 bg-surface-container-low px-2.5 py-1.5',
              'transition-colors hover:border-outline-variant hover:bg-surface-container',
            )}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-container-high">
              <ExternalLink className="size-4 text-on-surface-variant" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-primary" title={link.url}>
                {link.url}
              </p>
              <p className="truncate text-[10px] text-on-surface-variant">
                {[link.authorName, formatWallShortDate(link.createdAt)]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Estado vacío por pestaña (texto centrado, tono discreto). */
function SharedEmpty({ label }: { label: string }) {
  return <p className="px-1 py-3 text-center text-xs text-on-surface-variant">{label}</p>;
}

/** Esqueleto de carga: cuadrícula (media) o filas (docs/links). */
function SharedSkeleton({ type, count }: { type: WallSharedType; count: number }) {
  if (type === 'media') {
    return (
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-lg" />
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-11 rounded-md" />
      ))}
    </div>
  );
}
