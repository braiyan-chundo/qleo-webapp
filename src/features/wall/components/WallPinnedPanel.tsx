import { Pin } from 'lucide-react';

import { AuthedAvatar, identityAvatarFallback } from '@/shared/components/AuthedAvatar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { useWallPinned } from '../hooks/use-wall';
import { wallMessageAnchorId } from '../lib/wall-feed';
import { formatWallShortDate } from '../lib/wall-dates';
import type { WallMessage } from '../types/wall.types';

/**
 * Panel "Mensajes fijados" del `<aside>` derecho del Muro (QL-93, §3.27). Lista `GET
 * /wall/pinned` (vía `useWallPinned`, TanStack Query): título + contador + tarjetas de los
 * fijados. Al hacer clic en una tarjeta, si el mensaje está cargado en el hilo, se hace scroll
 * a él (ancla DOM `wallMessageAnchorId`); si no está en la ventana cargada del feed, no-op.
 */
export function WallPinnedPanel() {
  const { data, isLoading, isError } = useWallPinned();
  const pinned = data ?? [];

  return (
    <section aria-label="Mensajes fijados" className="flex flex-col gap-2">
      <header className="flex items-center gap-2 px-1">
        <Pin className="size-3.5 text-on-surface-variant" />
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
          Mensajes fijados
        </h2>
        {!isLoading && !isError && pinned.length > 0 && (
          <span className="ml-auto rounded-full bg-surface-container-high px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-on-surface-variant">
            {pinned.length}
          </span>
        )}
      </header>

      {isLoading ? (
        <PinnedSkeleton />
      ) : isError ? (
        <p className="px-1 text-xs text-on-surface-variant">
          No se pudieron cargar los fijados.
        </p>
      ) : pinned.length === 0 ? (
        <p className="px-1 text-xs text-on-surface-variant">
          Aún no hay mensajes fijados.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {pinned.map((message) => (
            <li key={message.id}>
              <PinnedCard message={message} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Tarjeta de un mensaje fijado: autor + extracto + "Por {pinnedBy} · {fecha}". */
function PinnedCard({ message }: { message: WallMessage }) {
  const { author, body, attachments, pinnedBy, pinnedAt } = message;
  // (QL-148) Los mensajes de sistema no se fijan; guarda defensiva para el estrechamiento de tipo.
  if (!author) return null;
  const excerpt = body.trim() || (attachments.length > 0 ? 'Adjunto' : '');

  const goToMessage = () => {
    const el = document.getElementById(wallMessageAnchorId(message.id));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <button
      type="button"
      onClick={goToMessage}
      className={cn(
        'flex w-full flex-col gap-1.5 rounded-xl border border-outline-variant/40 bg-surface-container-low p-2.5 text-left',
        'transition-colors hover:border-outline-variant hover:bg-surface-container',
      )}
    >
      <div className="flex items-center gap-2">
        <AuthedAvatar
          avatarDownloadUrl={author.avatarDownloadUrl}
          name={author.name}
          className="size-5 shrink-0 border border-outline-variant/50"
          fallbackClassName={cn(identityAvatarFallback, 'text-[9px]')}
        />
        <span className="truncate text-xs font-semibold text-on-surface">
          {author.name}
        </span>
      </div>

      {excerpt && (
        <p className="line-clamp-2 text-xs text-on-surface-variant">{excerpt}</p>
      )}

      {pinnedBy && pinnedAt && (
        <p className="truncate text-[10px] text-on-surface-variant/80">
          Por {pinnedBy.name} · {formatWallShortDate(pinnedAt)}
        </p>
      )}
    </button>
  );
}

/** Skeleton de carga del panel de fijados. */
function PinnedSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 2 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col gap-1.5 rounded-xl border border-outline-variant/40 bg-surface-container-low p-2.5"
        >
          <div className="flex items-center gap-2">
            <Skeleton className="size-5 rounded-full" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-2.5 w-24" />
        </div>
      ))}
    </div>
  );
}
