import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Ban,
  Check,
  Loader2,
  MoreVertical,
  Pencil,
  Pin,
  PinOff,
  Reply,
  SmilePlus,
  Trash2,
  X,
} from 'lucide-react';

import { useAuthStore } from '@/store/auth.store';
import { AuthedAvatar, identityAvatarFallback } from '@/shared/components/AuthedAvatar';
import type { CommentMention } from '@/features/comments/services/comments.service';
import { MentionTextarea } from '@/features/comments/components/MentionTextarea';
import { resolveMentionIds } from '@/features/comments/lib/mentions';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { cn } from '@/lib/utils';

import { wallMessageAnchorId, type WallFeedItem } from '../lib/wall-feed';
import { formatWallTime } from '../lib/wall-dates';
import { describeWallMessageDeletion } from '../lib/wall-attachments';
import {
  useDeleteWallMessage,
  useEditWallMessage,
  usePinMessage,
  useReactToWallMessage,
  useUnpinMessage,
} from '../hooks/use-wall';
import { useWallDirectory } from '../hooks/use-wall-directory';
import { useLongPress } from '../hooks/use-long-press';
import { notifyWallError } from '../lib/wall-errors';
import { WallMentionText } from './WallMentionText';
import { WallMessageAttachments } from './WallMessageAttachments';
import { WallReactionChips } from './WallReactionChips';
import { WallReactionPicker } from './WallReactionPicker';
import { WallReplyQuote } from './WallReplyQuote';

interface WallMessageItemProps {
  message: WallFeedItem;
  /**
   * `true` si este mensaje continúa un grupo del mismo autor (QL-99): se ocultan avatar y
   * nombre, y la burbuja se pega a la anterior. Lo decide `WallView` a partir del mensaje previo.
   */
  grouped?: boolean;
  /**
   * (QL-119) `true` mientras este mensaje es el destino de un salto del buscador: un **flash**
   * temporal (fondo suave) para localizarlo, estilo "jump to message" de WhatsApp.
   */
  highlighted?: boolean;
  /** (QL-103) Inicia una respuesta a este mensaje (el composer muestra la cita). */
  onReply?: (message: WallFeedItem) => void;
  /** (QL-103) Salta/scrollea al mensaje citado en el feed (si está cargado). */
  onJumpToMessage?: (id: string) => void;
}

/**
 * Una burbuja del muro (QL-90, rediseño chat QL-95): avatar + nombre + hora + cuerpo con
 * **menciones resaltadas** (`WallMentionText`, cruzando ids con el directorio; nunca HTML
 * crudo) + **adjuntos** (imágenes en línea / chips descargables / notas de voz). Los mensajes
 * **propios** se alinean a la **derecha** ("Tú", burbuja con tono distinto y avatar a la
 * derecha); el resto a la izquierda. Ofrece **responder** a cualquiera (QL-103) y, si el mensaje
 * es propio, **editar/borrar** (QL-102: borrar es SOLO del autor, ni ADMIN). Las acciones viven
 * en un menú **⋮** (`DropdownMenu`, QL-108) siempre visible y enfocable, accesible al tacto.
 */
export function WallMessageItem({
  message,
  grouped = false,
  highlighted = false,
  onReply,
  onJumpToMessage,
}: WallMessageItemProps) {
  const { author, body, mentions, attachments, createdAt, editedAt, pending, pinnedAt } =
    message;

  const currentUserId = useAuthStore((s) => s.user?.id);
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const isOwn = !!currentUserId && author.id === currentUserId;
  const canEdit = isOwn && !pending;
  // (QL-102) Borrar es SOLO del autor: ni ADMIN puede borrar mensajes ajenos. El backend valida
  // (403 `WALL_MESSAGE_NOT_AUTHOR`); aquí solo mostramos la acción a quien puede usarla.
  const canDelete = isOwn && !pending;
  // (QL-103) Responder está disponible sobre cualquier mensaje vivo ya confirmado (no optimista):
  // se cita por id, así que no aplica a un mensaje en vuelo ni a una lápida.
  const canReply = !!onReply && !pending && !message.deleted;
  // Fijar/desfijar es SOLO para ADMIN (rol de plataforma) y sobre mensajes ya confirmados
  // (no optimistas). Un MEMBER no ve la acción; si la invocara igual recibiría 403 (§3.27).
  const canPin = isAdmin && !pending;
  const isPinned = pinnedAt != null;

  const editMessage = useEditWallMessage();
  const deleteMessage = useDeleteWallMessage();
  const pinMessage = usePinMessage();
  const unpinMessage = useUnpinMessage();
  const pinBusy = pinMessage.isPending || unpinMessage.isPending;
  // Directorio para sembrar el editor con las menciones ya presentes (ids → {id,name}) y, (QL-147),
  // para resolver los nombres del tooltip "quién reaccionó" cuando el mensaje tiene reacciones.
  const { resolve } = useWallDirectory(canEdit || message.reactions.length > 0);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(body);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const mentionCandidates = useRef<CommentMention[]>([]);

  // (QL-147) Reacciones estilo WhatsApp: selector (hover/long-press) + chips bajo el mensaje.
  const [pickerOpen, setPickerOpen] = useState(false);
  const reactToMessage = useReactToWallMessage();
  const reactMutate = reactToMessage.mutate;
  // Reaccionar aplica a mensajes vivos ya confirmados (la lápida retorna antes; un mensaje en vuelo
  // no tiene id real). Cualquier autenticado puede reaccionar, incluido el propio autor.
  const canReact = !pending;
  // Emoji con el que YA reaccionó el usuario (para resaltarlo en la barra rápida), o null.
  const myReactionEmoji =
    message.reactions.find((r) => !!currentUserId && r.userIds.includes(currentUserId))
      ?.emoji ?? null;

  const handleReact = useCallback(
    (emoji: string) => {
      setPickerOpen(false);
      reactMutate(
        { id: message.id, emoji },
        { onError: (err) => notifyWallError(err, 'No se pudo reaccionar') },
      );
    },
    [message.id, reactMutate],
  );

  // Long-press abre el selector en táctil (sin hover); en desktop lo abre el botón al pasar el cursor.
  const longPress = useLongPress(() => {
    if (canReact) setPickerOpen(true);
  });

  // Tooltip "quién reaccionó": nombres del directorio ("Tú" para el propio); si aún no cargó, cae al
  // conteo. `resolve` ya está habilitado (arriba) cuando el mensaje tiene reacciones.
  const describeReactors = useCallback(
    (userIds: string[]) => {
      const nameById = new Map(resolve(userIds).map((u) => [u.id, u.name]));
      const known = userIds
        .map((id) => (id === currentUserId ? 'Tú' : nameById.get(id)))
        .filter((name): name is string => !!name);
      const unknown = userIds.length - known.length;
      if (known.length === 0) {
        return userIds.length === 1 ? '1 reacción' : `${userIds.length} reacciones`;
      }
      if (unknown > 0) known.push(unknown === 1 ? '1 más' : `${unknown} más`);
      return known.join(', ');
    },
    [resolve, currentUserId],
  );

  const registerMention = useCallback((mention: CommentMention) => {
    if (!mentionCandidates.current.some((m) => m.id === mention.id)) {
      mentionCandidates.current.push(mention);
    }
  }, []);

  const startEdit = () => {
    setDraft(body);
    mentionCandidates.current = [...resolve(mentions)];
    setEditing(true);
  };

  const commitEdit = () => {
    const next = draft.trim();
    // El PATCH exige body no vacío (la edición no gestiona adjuntos). Si vació el texto,
    // no enviamos: cancelamos la edición (para borrar el mensaje está el botón eliminar).
    if (!next || next === body) {
      setEditing(false);
      return;
    }
    const nextMentions = resolveMentionIds(next, mentionCandidates.current);
    editMessage.mutate(
      { id: message.id, body: next, mentions: nextMentions },
      {
        onSuccess: () => {
          setEditing(false);
          toast.success('Mensaje actualizado');
        },
        onError: (err) => notifyWallError(err, 'No se pudo editar el mensaje'),
      },
    );
  };

  const handleDelete = () => {
    deleteMessage.mutate(message.id, {
      onSuccess: () => {
        setConfirmDelete(false);
        toast.success('Mensaje eliminado');
      },
      onError: (err) => {
        setConfirmDelete(false);
        notifyWallError(err, 'No se pudo eliminar el mensaje');
      },
    });
  };

  const handleTogglePin = () => {
    const mutation = isPinned ? unpinMessage : pinMessage;
    mutation.mutate(message.id, {
      onSuccess: () =>
        toast.success(isPinned ? 'Mensaje desfijado' : 'Mensaje fijado'),
      onError: (err) =>
        notifyWallError(
          err,
          isPinned ? 'No se pudo desfijar el mensaje' : 'No se pudo fijar el mensaje',
        ),
    });
  };

  // (QL-108) Menú de opciones por burbuja: un único disparador **⋮** que abre un `DropdownMenu`
  // con las acciones permitidas (mismos gates que antes). Sustituye a la fila de botones que solo
  // aparecía al hover (inaccesible al tacto): el ⋮ es **siempre visible y enfocable**, por lo que
  // funciona en móvil. Es `shrink-0` y de ancho fijo (`size-7`), así que no empuja el ancho de la
  // burbuja más allá del `max-width` de la columna (QL-105).
  const actions = (canReply || canEdit || canDelete || canPin) && !editing && (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 self-center text-on-surface-variant"
          aria-label="Opciones del mensaje"
        >
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={isOwn ? 'start' : 'end'} className="w-40">
        {canReply && (
          <DropdownMenuItem onSelect={() => onReply?.(message)}>
            <Reply />
            Responder
          </DropdownMenuItem>
        )}
        {canPin && (
          <DropdownMenuItem onSelect={handleTogglePin} disabled={pinBusy}>
            {isPinned ? <PinOff /> : <Pin />}
            {isPinned ? 'Desfijar' : 'Fijar'}
          </DropdownMenuItem>
        )}
        {canEdit && (
          <DropdownMenuItem onSelect={startEdit}>
            <Pencil />
            Editar
          </DropdownMenuItem>
        )}
        {canDelete && (
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setConfirmDelete(true)}
          >
            <Trash2 />
            Eliminar
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // (QL-147) Disparador de reacción para **desktop**: aparece al pasar el cursor sobre el mensaje
  // (`group-hover/msg`) y es enfocable por teclado (`focus-visible`). En táctil, donde no hay hover,
  // el selector se abre con long-press sobre la burbuja. Ambos abren el mismo `WallReactionPicker`.
  const reactionTrigger = canReact && (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => setPickerOpen(true)}
      aria-label="Reaccionar"
      className="size-7 shrink-0 self-center text-on-surface-variant opacity-0 transition-opacity focus-visible:opacity-100 group-hover/msg:opacity-100"
    >
      <SmilePlus className="size-4" />
    </Button>
  );

  // Avatar de la burbuja. En un mensaje **agrupado** (QL-99) se sustituye por un hueco del
  // mismo ancho para mantener la alineación de las burbujas sin repintar el avatar.
  const avatarSlot = grouped ? (
    <div className="size-9 shrink-0" aria-hidden />
  ) : (
    <AuthedAvatar
      avatarDownloadUrl={author.avatarDownloadUrl}
      name={author.name}
      className="size-9 shrink-0 border border-outline-variant/50"
      fallbackClassName={cn(identityAvatarFallback, 'text-xs')}
    />
  );

  // Mensaje ELIMINADO → "lápida" tipo WhatsApp (§3.27): conserva avatar, autor, hora y
  // alineación (izq/der), pero sin acciones, adjuntos, menciones ni fijado. Se decide por
  // `message.deleted` (el backend ya devuelve el borrado con los campos vaciados).
  if (message.deleted) {
    return (
      <div
        id={wallMessageAnchorId(message.id)}
        className={cn(
          'scroll-mt-4 rounded-2xl transition-colors duration-700',
          grouped && '-mt-2',
          highlighted && 'bg-primary/15',
        )}
      >
        <div
          className={cn(
            'flex min-w-0 items-end gap-2.5 px-1',
            isOwn && 'flex-row-reverse',
          )}
        >
          {avatarSlot}
          <div
            className={cn(
              'flex min-w-0 max-w-[85%] flex-col gap-1 md:max-w-[75%]',
              isOwn ? 'items-end' : 'items-start',
            )}
          >
            {!grouped && (
              <div className="flex items-baseline gap-2 px-1">
                <span className="truncate text-xs font-semibold text-on-surface">
                  {isOwn ? 'Tú' : author.name}
                </span>
                <span className="shrink-0 text-[11px] text-on-surface-variant tabular-nums">
                  {formatWallTime(createdAt)}
                </span>
              </div>
            )}
            <div
              className={cn(
                'flex items-center gap-1.5 rounded-2xl border border-dashed border-outline-variant/60 px-3.5 py-2 text-on-surface-variant',
                isOwn ? 'rounded-br-sm' : 'rounded-bl-sm',
              )}
            >
              <Ban className="size-3.5 shrink-0" aria-hidden />
              <span className="text-sm italic">Este mensaje fue eliminado</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      id={wallMessageAnchorId(message.id)}
      className={cn(
        'scroll-mt-4 rounded-2xl transition-colors duration-700',
        grouped && '-mt-2',
        highlighted && 'bg-primary/15',
      )}
    >
      {/* Indicador de sistema, sutil y centrado, cuando el mensaje está fijado (QL-93, §3.27):
          se **deriva** de `pinnedAt`/`pinnedBy` (no hay mensaje-sistema en el feed). Va justo
          encima del mensaje fijado dentro del hilo (mockup Lote K). */}
      {isPinned && message.pinnedBy && (
        <div className="flex justify-center pb-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container px-3 py-1 text-[11px] font-medium text-on-surface-variant">
            <Pin className="size-3" />
            {message.pinnedBy.name} fijó un mensaje
          </span>
        </div>
      )}

      <div
        className={cn(
          'group/msg flex min-w-0 items-end gap-2.5 px-1',
          isOwn && 'flex-row-reverse',
          pending && 'opacity-60',
        )}
      >
        {avatarSlot}

      <div
        className={cn(
          'flex min-w-0 max-w-[85%] flex-col gap-1 md:max-w-[75%]',
          isOwn ? 'items-end' : 'items-start',
        )}
      >
        {/* Nombre + hora (se omite en mensajes agrupados, QL-99) */}
        {!grouped && (
          <div className="flex items-baseline gap-2 px-1">
            <span className="truncate text-xs font-semibold text-on-surface">
              {isOwn ? 'Tú' : author.name}
            </span>
            <span className="shrink-0 text-[11px] text-on-surface-variant tabular-nums">
              {pending ? 'enviando…' : formatWallTime(createdAt)}
            </span>
            {!pending && editedAt != null && (
              <span className="shrink-0 text-[11px] italic text-on-surface-variant">
                (editado)
              </span>
            )}
          </div>
        )}

        {editing ? (
          <div className="w-full space-y-2">
            <MentionTextarea
              autoFocus
              value={draft}
              onChange={setDraft}
              onMention={registerMention}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  commitEdit();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setEditing(false);
                }
              }}
              rows={2}
              disabled={editMessage.isPending}
              className="bg-surface-container-low"
            />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={commitEdit}
                disabled={editMessage.isPending}
              >
                {editMessage.isPending ? <Loader2 className="animate-spin" /> : <Check />}
                Guardar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEditing(false)}
                disabled={editMessage.isPending}
              >
                <X />
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div
              className={cn(
                'flex min-w-0 max-w-full items-center gap-1',
                isOwn && 'flex-row-reverse',
              )}
            >
              {/* (QL-147) La burbuja es el ancla del selector de reacciones (hover/long-press). */}
              <WallReactionPicker
                open={pickerOpen}
                onOpenChange={setPickerOpen}
                activeEmoji={myReactionEmoji}
                onSelect={handleReact}
                align={isOwn ? 'end' : 'start'}
              >
                {/* Burbuja: tono distinto para los mensajes propios; esquina "pinchada"
                    hacia el avatar (izq. ajenos, der. propios) para el look de chat. */}
                <div
                  {...longPress}
                  className={cn(
                    'min-w-0 max-w-full rounded-2xl px-3.5 py-2',
                    isOwn
                      ? 'rounded-br-sm bg-surface-container-high text-on-surface'
                      : 'rounded-bl-sm bg-surface-container text-on-surface',
                  )}
                >
                  {/* Cita del mensaje respondido (QL-103): clicable → salta al original. */}
                  {message.replyTo && (
                    <WallReplyQuote
                      reply={message.replyTo}
                      onJump={onJumpToMessage}
                      className="mb-1.5"
                    />
                  )}
                  {body.length > 0 && (
                    <p className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">
                      <WallMentionText body={body} mentions={mentions} />
                    </p>
                  )}
                  {attachments.length > 0 && (
                    <WallMessageAttachments attachments={attachments} />
                  )}
                </div>
              </WallReactionPicker>
              {reactionTrigger}
              {actions}
            </div>

            {/* (QL-147) Chips de reacciones bajo el mensaje, resaltando la propia. */}
            {message.reactions.length > 0 && (
              <WallReactionChips
                reactions={message.reactions}
                currentUserId={currentUserId}
                onToggle={handleReact}
                describeReactors={describeReactors}
                align={isOwn ? 'end' : 'start'}
                disabled={reactToMessage.isPending}
              />
            )}
          </>
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
            <AlertDialogTitle>Eliminar mensaje</AlertDialogTitle>
            <AlertDialogDescription>
              {describeWallMessageDeletion(attachments.length)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMessage.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleteMessage.isPending}
            >
              {deleteMessage.isPending && <Loader2 className="animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
}
