import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Info, Loader2, MessagesSquare, RefreshCw, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { BackButton } from '@/shared/components/BackButton';

import {
  useMarkWallRead,
  useSendWallMessage,
  useWallFeed,
  type SendWallMessageInput,
} from '../hooks/use-wall';
import { useWallScroll } from '../hooks/use-wall-scroll';
import { useWallPresence } from '../hooks/use-wall-presence';
import { dateSeparatorLabel, isSameDay, withinGroupWindow } from '../lib/wall-dates';
import { buildReplyPreview } from '../lib/wall-reply';
import { notifyWallError } from '../lib/wall-errors';
import { wallMessageAnchorId, type WallFeedItem } from '../lib/wall-feed';
import type { WallReplyPreview, WallSearchResult } from '../types/wall.types';
import { WallComposer } from './WallComposer';
import { WallMessageItem } from './WallMessageItem';
import { WallSearch } from './WallSearch';
import { WallTypingIndicator } from './WallTypingIndicator';

/**
 * Columna de chat del Muro Corporativo (QL-89/QL-90, rediseño QL-95, §3.25): tablón/chat
 * único global. Cabecera + lista de burbujas (recientes abajo, historial hacia arriba, con
 * **separadores de día**) + composer fijo. Tiempo real por **polling** mientras la vista está
 * montada y la pestaña del navegador visible (TanStack pausa el intervalo en segundo plano).
 *
 * Al vivir en su **ruta propia** (`/muro`, `WallPage`), la vista siempre está "activa" cuando
 * se monta: activamos el polling y marcamos leído en el montaje. El layout deja sitio a la
 * derecha del título para el "· N en línea" que añadirá QL-97 (presencia por WebSocket).
 */
interface WallViewProps {
  /** ¿El panel de información del canal está abierto? (refleja el estado del botón del header). */
  infoOpen?: boolean;
  /**
   * Alterna el panel de información del canal (columna lateral en desktop; vista completa que
   * sustituye al chat en móvil). Si no se pasa, no se muestra el botón (retrocompatible).
   */
  onToggleInfo?: () => void;
}

export function WallView({ infoOpen = false, onToggleInfo }: WallViewProps) {
  const feed = useWallFeed(true);
  const send = useSendWallMessage();
  const markRead = useMarkWallRead();
  const presence = useWallPresence();
  const { scrollRef, handleScroll, scrollToBottom, beginJump, scrollToMessage } =
    useWallScroll({
      messages: feed.messages,
      hasMoreOlder: feed.hasMoreOlder,
      isLoadingOlder: feed.isLoadingOlder,
      loadOlder: feed.loadOlder,
    });

  // (QL-119) Buscador del muro: estado de UI **local** (toggle + mensaje resaltado tras el salto).
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(
    () => () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    },
    [],
  );

  const { jumpToMessage: jumpFeedToMessage } = feed;
  // (QL-119) Salto desde un resultado de búsqueda: carga la ventana `around` (reemplaza el feed),
  // cierra la búsqueda y, al montar la ventana, centra el mensaje y lo resalta unos segundos.
  const handleSearchJump = useCallback(
    (result: WallSearchResult) => {
      setSearchOpen(false);
      beginJump();
      setHighlightedId(result.id);
      jumpFeedToMessage(result.id, {
        onSuccess: () => {
          // Espera al paint de la nueva ventana para localizar el ancla DOM y centrarla.
          requestAnimationFrame(() => scrollToMessage(result.id));
          if (highlightTimer.current) clearTimeout(highlightTimer.current);
          highlightTimer.current = setTimeout(() => setHighlightedId(null), 2200);
        },
        onError: (err) => {
          setHighlightedId(null);
          notifyWallError(err, 'No se pudo abrir el mensaje.');
        },
      });
    },
    [beginJump, jumpFeedToMessage, scrollToMessage],
  );

  // Marca leído al **entrar** al muro (montaje de la ruta `/muro`). `markRead.mutate` es
  // estable, así que el efecto solo corre una vez por apertura, no por render ni por tick del
  // polling. Tras el éxito, el badge del nav cae a 0 (invalida `wall/unread-count`).
  const markReadMutate = markRead.mutate;
  useEffect(() => {
    markReadMutate();
  }, [markReadMutate]);

  // Estado de "respondiendo a…" (QL-103): cita reducida del mensaje seleccionado, o null.
  const [replyTarget, setReplyTarget] = useState<WallReplyPreview | null>(null);
  const startReply = useCallback((msg: WallFeedItem) => {
    setReplyTarget(buildReplyPreview(msg));
  }, []);
  const cancelReply = useCallback(() => setReplyTarget(null), []);

  // Salta al mensaje citado si está cargado en el hilo; si no, no-op suave.
  const jumpToMessage = useCallback((id: string) => {
    const node = document.getElementById(wallMessageAnchorId(id));
    node?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const handleSend = (payload: SendWallMessageInput) => {
    send.mutate(payload);
    setReplyTarget(null);
    // Marca "estoy abajo" para que el optimista y su confirmación auto-sigan al fondo.
    scrollToBottom('smooth');
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface-container-lowest">
      {/* Cabecera del muro. `relative` para anclar el panel de resultados del buscador (QL-119). */}
      <header className="relative flex items-center gap-2 border-b border-outline-variant/40 bg-surface px-4 py-3 md:px-6">
        {searchOpen ? (
          // (QL-119) Modo búsqueda: el input inline sustituye al bloque "Muro Corporativo".
          <WallSearch onClose={() => setSearchOpen(false)} onJump={handleSearchJump} />
        ) : (
          <>
            <BackButton fallback={{ to: '/', label: 'Inicio' }} />
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container dark:text-primary">
              <MessagesSquare className="size-5" />
            </span>
            <div className="min-w-0">
              {/* "· N en línea": presencia en tiempo real por WebSocket (QL-97, §3.26). Mientras
                  no hay conteo aún se omite (no se pinta "· 0 en línea" en frío). */}
              <div className="flex items-baseline gap-1.5">
                <h1 className="truncate text-base font-semibold text-on-surface">
                  Muro Corporativo
                </h1>
                {!presence.isLoading && (
                  <span className="shrink-0 text-xs font-medium text-on-surface-variant tabular-nums">
                    · {presence.count} en línea
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-on-surface-variant">
                Un canal para todo el equipo
              </p>
            </div>

            {/* Acciones a la derecha del header (QL-119): buscar mensaje + info del canal, juntos
                en el extremo opuesto al icono del muro. `ml-auto` empuja el grupo a la derecha. */}
            <div className="ml-auto flex shrink-0 items-center gap-1">
              {/* Disparador del buscador (QL-119): junto al icono de información. */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setSearchOpen(true)}
                aria-label="Buscar en el muro"
                className="shrink-0 text-on-surface-variant"
              >
                <Search className="size-5" />
              </Button>

              {/* Trigger del panel de información (QL-97): oculta/muestra el aside en desktop y abre
                  la vista de "info del canal" a pantalla completa en móvil. */}
              {onToggleInfo && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onToggleInfo}
                  aria-pressed={infoOpen}
                  aria-label={
                    infoOpen ? 'Ocultar información del canal' : 'Mostrar información del canal'
                  }
                  className={cn(
                    'shrink-0',
                    infoOpen ? 'text-primary' : 'text-on-surface-variant',
                  )}
                >
                  <Info className="size-5" />
                </Button>
              )}
            </div>
          </>
        )}
      </header>

      {/* Cuerpo: mensajes */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto px-3 py-4 md:px-6"
      >
        {feed.isLoading ? (
          <WallSkeleton />
        ) : feed.isError ? (
          <WallError message={feed.error?.message} onRetry={feed.refetch} />
        ) : feed.messages.length === 0 ? (
          <WallEmpty />
        ) : (
          <div className="flex w-full flex-col gap-4">
            {feed.isLoadingOlder && (
              <div className="flex justify-center py-1 text-on-surface-variant">
                <Loader2 className="size-4 animate-spin" />
              </div>
            )}
            {feed.messages.map((message, index) => {
              const prev = feed.messages[index - 1];
              const showSeparator =
                !prev || !isSameDay(prev.createdAt, message.createdAt);
              // Agrupa (estilo WhatsApp, QL-99) los mensajes seguidos del **mismo autor** dentro
              // de ~5 min: los subsiguientes no repintan avatar ni nombre. Se rompe el grupo si
              // hay separador de día, cambia el autor, o el mensaje está fijado (lleva su banner).
              const grouped =
                !!prev &&
                !showSeparator &&
                prev.author.id === message.author.id &&
                message.pinnedAt == null &&
                withinGroupWindow(prev.createdAt, message.createdAt);
              return (
                <Fragment key={message.id}>
                  {showSeparator && <DateSeparator iso={message.createdAt} />}
                  <WallMessageItem
                    message={message}
                    grouped={grouped}
                    highlighted={message.id === highlightedId}
                    onReply={startReply}
                    onJumpToMessage={jumpToMessage}
                  />
                </Fragment>
              );
            })}
          </div>
        )}
      </div>

      {/* Indicador efímero "escribiendo…/grabando audio…" (QL-125), sobre el composer estilo chat.
          Se pinta solo cuando hay typers; si no, no ocupa espacio. */}
      <WallTypingIndicator />

      {/* Barra de escritura fija */}
      <WallComposer
        onSend={handleSend}
        isSending={send.isPending}
        replyTo={replyTarget}
        onCancelReply={cancelReply}
      />
    </div>
  );
}

/** Píldora centrada de separación de día ("HOY", "AYER", fecha) entre mensajes. */
function DateSeparator({ iso }: { iso: string }) {
  return (
    <div className="flex justify-center py-1">
      <span className="rounded-full bg-surface-container px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-on-surface-variant">
        {dateSeparatorLabel(iso)}
      </span>
    </div>
  );
}

/** Skeleton de carga inicial: varias filas de mensaje. */
function WallSkeleton() {
  return (
    <div className="flex w-full flex-col gap-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex gap-3 px-1">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Estado vacío: nadie ha escrito aún. */
function WallEmpty() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
        <MessagesSquare className="size-7" />
      </span>
      <p className="max-w-xs text-sm text-on-surface-variant">
        Sé el primero en escribir en el Muro Corporativo
      </p>
    </div>
  );
}

/** Estado de error con reintento. */
function WallError({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-error-container text-error">
        <AlertCircle className="size-7" />
      </span>
      <p className="max-w-xs text-sm text-on-surface-variant">
        {message || 'No se pudo cargar el Muro Corporativo.'}
      </p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="size-4" />
        Reintentar
      </Button>
    </div>
  );
}
