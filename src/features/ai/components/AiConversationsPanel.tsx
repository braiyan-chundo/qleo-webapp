import { useState } from 'react';
import { Eraser, Loader2, MessageSquarePlus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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

import {
  useAiConversations,
  useClearAiConversations,
  useDeleteAiConversation,
} from '../hooks/use-ai-conversations';

interface AiConversationsPanelProps {
  /** Conversación activa en el chat (para resaltarla). */
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}

/** Fecha compacta local. */
function formatShort(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/**
 * Historial de conversaciones de IA (QL-190, §3.63). Lista mis conversaciones (TanStack Query),
 * permite empezar una nueva, cargar una pasada y borrarla (con confirmación). Dato de servidor →
 * caché de TanStack Query; el borrado invalida la lista.
 */
export function AiConversationsPanel({ activeId, onSelect, onNew }: AiConversationsPanelProps) {
  const { data: conversations, isLoading, isError, error } = useAiConversations();
  const deleteConversation = useDeleteAiConversation();
  const clearConversations = useClearAiConversations();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const hasConversations = !!conversations && conversations.length > 0;

  const handleDelete = () => {
    const id = confirmingId;
    if (!id) return;
    deleteConversation.mutate(id, {
      onSuccess: () => {
        setConfirmingId(null);
        toast.success('Conversación eliminada.');
        // Si borramos la activa, arranca una nueva para no dejar el chat huérfano.
        if (id === activeId) onNew();
      },
      onError: (err) => {
        setConfirmingId(null);
        toast.error(err instanceof Error ? err.message : 'No se pudo eliminar la conversación.');
      },
    });
  };

  const handleClearAll = () => {
    clearConversations.mutate(undefined, {
      onSuccess: ({ deletedCount }) => {
        setConfirmClear(false);
        toast.success(
          `${deletedCount} conversación${deletedCount === 1 ? '' : 'es'} eliminada${deletedCount === 1 ? '' : 's'}.`,
        );
        // Se borró la activa junto con el resto: arranca una nueva.
        onNew();
      },
      onError: (err) => {
        toast.error(
          err instanceof Error ? err.message : 'No se pudieron eliminar las conversaciones.',
        );
      },
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 p-3">
        <Button variant="outline" className="flex-1 justify-start gap-2" onClick={onNew}>
          <MessageSquarePlus className="size-4" />
          Nueva conversación
        </Button>
        {hasConversations && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-on-surface-variant hover:text-error"
            onClick={() => setConfirmClear(true)}
            aria-label="Limpiar todas las conversaciones"
            title="Limpiar todas las conversaciones"
          >
            <Eraser className="size-4" />
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {isLoading ? (
          <div className="space-y-2 px-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-11 rounded-lg" />
            ))}
          </div>
        ) : isError ? (
          <p className="px-3 py-4 text-xs text-on-surface-variant">
            {error instanceof Error ? error.message : 'No se pudo cargar el historial.'}
          </p>
        ) : !conversations || conversations.length === 0 ? (
          <p className="px-3 py-4 text-xs text-on-surface-variant">
            Aún no tienes conversaciones. Empieza una nueva.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {conversations.map((conversation) => {
              const isActive = conversation.id === activeId;
              return (
                <li key={conversation.id} className="group/conv relative">
                  <button
                    type="button"
                    onClick={() => onSelect(conversation.id)}
                    className={cn(
                      'flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 pr-9 text-left transition-colors',
                      isActive
                        ? 'bg-surface-container-highest text-on-surface'
                        : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
                    )}
                  >
                    <span className="w-full truncate text-sm font-medium">
                      {conversation.title || 'Conversación'}
                    </span>
                    <span className="text-xs text-on-surface-variant">
                      {conversation.messageCount} mensaje{conversation.messageCount === 1 ? '' : 's'}
                      {' · '}
                      {formatShort(conversation.updatedAt)}
                    </span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-1.5 right-1 size-7 text-on-surface-variant opacity-0 transition-opacity group-hover/conv:opacity-100 focus-visible:opacity-100 hover:text-error"
                    onClick={() => setConfirmingId(conversation.id)}
                    aria-label="Eliminar conversación"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <AlertDialog
        open={!!confirmingId}
        onOpenChange={(open) => {
          if (!open) setConfirmingId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar conversación</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará esta conversación y sus mensajes. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteConversation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleteConversation.isPending}
            >
              {deleteConversation.isPending && <Loader2 className="animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpiar todas las conversaciones</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán <span className="font-medium text-on-surface">todas</span> tus
              conversaciones y sus mensajes. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearConversations.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault();
                handleClearAll();
              }}
              disabled={clearConversations.isPending}
            >
              {clearConversations.isPending && <Loader2 className="animate-spin" />}
              Limpiar todas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
