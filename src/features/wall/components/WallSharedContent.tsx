import { Download, ExternalLink, Loader2 } from 'lucide-react';
import type { UseQueryResult } from '@tanstack/react-query';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import type { Attachment } from '@/features/attachments/services/attachments.service';
import { AttachmentIcon } from '@/features/attachments/components/AttachmentIcon';
import { useDownloadAttachment } from '@/features/attachments/hooks/use-attachments';
import { formatFileSize, notifyAttachmentError } from '@/features/attachments/lib/files';

import { formatWallShortDate } from '../lib/wall-dates';
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

/**
 * Cuerpo de la galería "Archivos compartidos" (QL-96, §3.28) para un `type` dado: pinta la
 * cuadrícula de miniaturas (`media`), la lista de chips descargables (`docs`) o la lista de
 * enlaces (`links`), con estados loading/error/empty. Se reutiliza tal cual en el panel del
 * aside y en el modal "Ver todos" (solo cambian `skeletonCount` y el contenedor externo).
 */
export function WallSharedContent({ type, query, skeletonCount = 6 }: WallSharedContentProps) {
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
    <SharedMediaGrid items={attachments} />
  ) : (
    <SharedDocsList items={attachments} />
  );
}

/** Cuadrícula de miniaturas; click descarga la imagen (blob+Bearer). */
function SharedMediaGrid({ items }: { items: Attachment[] }) {
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
        />
      ))}
    </div>
  );
}

/** Lista de chips (icono + nombre + tamaño) descargables (blob+Bearer). */
function SharedDocsList({ items }: { items: Attachment[] }) {
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
        return (
          <li key={attachment.id}>
            <button
              type="button"
              onClick={() => handleDownload(attachment)}
              disabled={isDownloading}
              aria-label={`Descargar ${attachment.originalName}`}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-md border border-outline-variant/40 bg-surface-container-low px-2.5 py-1.5 text-left',
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
