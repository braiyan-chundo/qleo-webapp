import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, MessageSquare, Trash2 } from 'lucide-react';

import { ApiError } from '@/core/api/fetch-client';
import type { TaskRole } from '@/features/tasks/services/tasks.service';
import { useAuthStore } from '@/store/auth.store';
import { AuthedAvatar } from '@/shared/components/AuthedAvatar';
import { CollapsibleText } from '@/shared/components/CollapsibleText';
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

import type { Comment } from '../services/comments.service';
import { useComments, useDeleteComment } from '../hooks/use-comments';
import { CommentAttachments } from './CommentAttachments';
import { CommentComposer } from './CommentComposer';
import { MentionText } from './MentionText';

interface CommentsPanelProps {
  task: { id: string; currentUserRole: TaskRole | null };
}

/** ISO → fecha + hora legible según el locale del navegador (ej. "2 jul 2026, 14:30"). */
function formatDateTime(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Traduce cualquier fallo de comentarios a un toast según §3.9 (READ_ONLY_ROLE / 403 genérico). */
function notifyError(err: unknown, fallback: string) {
  if (err instanceof ApiError) {
    if (err.code === 'READ_ONLY_ROLE') {
      toast.error('Tu rol es de solo lectura.');
      return;
    }
    if (err.code === 'COMMENT_ATTACHMENT_INVALID') {
      toast.error('No se pudo adjuntar el archivo al comentario. Vuelve a intentarlo.');
      return;
    }
    if (err.code === 'COMMENT_NOT_EDITABLE') {
      // (QL-176) Los comentarios ya no se editan; la UI no ofrece la acción, pero si llegara
      // (pestaña vieja abierta) el mensaje debe ser claro.
      toast.error('Los comentarios no se pueden editar.');
      return;
    }
    toast.error(err.message);
    return;
  }
  toast.error(err instanceof Error ? err.message : fallback);
}

/**
 * Panel del hilo de comentarios dentro del detalle de tarea (QL-12, §3.9). El hilo se muestra
 * cronológico ascendente (más reciente abajo) con la caja de comentar al final. Deriva `canComment`
 * del rol por tarea (CREATOR/ASSIGNEE/COLLABORATOR).
 *
 * (QL-176) **Un comentario no se edita**: solo se puede **eliminar** el propio. (QL-174) Cada
 * comentario puede traer adjuntos, que se abren en el visor compartido. (QL-173) Los cuerpos
 * largos se recortan con "Leer más".
 */
export function CommentsPanel({ task }: CommentsPanelProps) {
  const role = task.currentUserRole;
  const canComment =
    role === 'CREATOR' || role === 'ASSIGNEE' || role === 'COLLABORATOR';
  const currentUserId = useAuthStore((s) => s.user?.id);

  const { data: comments, isLoading, isError, error } = useComments(task.id);

  const total = comments?.length ?? 0;

  return (
    <div className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-4 py-3">
      <div className="flex items-center gap-2">
        <MessageSquare className="size-4 text-on-surface-variant" />
        <p className="text-xs font-medium text-on-surface-variant">Comentarios</p>
        {total > 0 && (
          <span className="ml-auto text-xs font-medium tabular-nums text-on-surface-variant">
            {total}
          </span>
        )}
      </div>

      {isLoading && (
        <div className="mt-3 space-y-3">
          <Skeleton className="h-12 w-full rounded-md" />
          <Skeleton className="h-12 w-5/6 rounded-md" />
        </div>
      )}

      {isError && (
        <p className="mt-3 rounded-md border border-error/20 bg-error-container px-3 py-2 text-xs font-medium text-on-error-container">
          {error instanceof Error ? error.message : 'No se pudieron cargar los comentarios'}
        </p>
      )}

      {!isLoading && !isError && total === 0 && (
        <p className="mt-3 text-sm text-on-surface-variant">
          {canComment ? 'Sé el primero en comentar.' : 'Aún no hay comentarios.'}
        </p>
      )}

      {!isLoading && !isError && comments && total > 0 && (
        <ul className="mt-3 space-y-3">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              taskId={task.id}
              isOwn={!!currentUserId && comment.authorId === currentUserId}
            />
          ))}
        </ul>
      )}

      {canComment && !isError && <CommentComposer taskId={task.id} onError={notifyError} />}

      {!canComment && role === 'OBSERVER' && !isError && (
        <p className="mt-3 text-xs text-on-surface-variant">
          Tu rol es de solo lectura.
        </p>
      )}
    </div>
  );
}

interface CommentItemProps {
  comment: Comment;
  taskId: string;
  isOwn: boolean;
}

/**
 * Un comentario del hilo: avatar + autor + fecha (+ "editado") + cuerpo + adjuntos. Si es propio,
 * ofrece **eliminar** (QL-176: la edición ya no existe; la etiqueta "editado" se conserva porque
 * es un dato real de comentarios antiguos).
 */
function CommentItem({ comment, taskId, isOwn }: CommentItemProps) {
  const deleteComment = useDeleteComment(taskId);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const authorName = comment.author?.name ?? 'Usuario';
  const attachments = comment.attachments ?? [];

  const handleDelete = () => {
    deleteComment.mutate(comment.id, {
      onSuccess: () => {
        setConfirmDelete(false);
        toast.success('Comentario eliminado');
      },
      onError: (err) => {
        setConfirmDelete(false);
        notifyError(err, 'No se pudo eliminar el comentario');
      },
    });
  };

  return (
    <li className="group/comment flex gap-3">
      <AuthedAvatar
        size="sm"
        className="mt-0.5 shrink-0"
        avatarDownloadUrl={comment.author?.avatarDownloadUrl}
        avatarUrl={comment.author?.avatarUrl}
        name={authorName}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-on-surface">
            {authorName}
          </span>
          <span className="shrink-0 text-xs text-on-surface-variant">
            {formatDateTime(comment.createdAt)}
          </span>
          {comment.editedAt && (
            <span className="shrink-0 text-xs text-on-surface-variant">· editado</span>
          )}

          {isOwn && (
            <div className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover/comment:opacity-100 focus-within:opacity-100">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 text-error hover:text-error"
                onClick={() => setConfirmDelete(true)}
                aria-label="Eliminar comentario"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* (QL-173) Cuerpo recortado a ~6 líneas con "Leer más". Las menciones se siguen
            renderizando con `MentionText`: `CollapsibleText` solo recorta la caja. */}
        <CollapsibleText fadeFrom="from-surface-container-lowest" className="mt-0.5">
          <p className="text-sm break-words whitespace-pre-wrap text-on-surface">
            <MentionText body={comment.body} mentions={comment.mentions} />
          </p>
        </CollapsibleText>

        {/* (QL-174) Adjuntos del comentario → visor compartido al hacer click. */}
        <CommentAttachments attachments={attachments} />
      </div>

      <AlertDialog
        open={confirmDelete}
        onOpenChange={(o) => {
          if (!o) setConfirmDelete(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar comentario</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Seguro que quieres eliminar este comentario? Esta acción no se puede
              deshacer.
              {attachments.length > 0 &&
                ' Los archivos adjuntos seguirán disponibles en los adjuntos de la tarea.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteComment.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleteComment.isPending}
            >
              {deleteComment.isPending && <Loader2 className="animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
