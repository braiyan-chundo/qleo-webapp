import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Check, Loader2, MessageSquare, Pencil, Send, Trash2, X } from 'lucide-react';

import { ApiError } from '@/core/api/fetch-client';
import type { TaskRole } from '@/features/tasks/services/tasks.service';
import { useAuthStore } from '@/store/auth.store';
import { AuthedAvatar } from '@/shared/components/AuthedAvatar';
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

import type { Comment, CommentMention } from '../services/comments.service';
import {
  useAddComment,
  useComments,
  useDeleteComment,
  useUpdateComment,
} from '../hooks/use-comments';
import { resolveMentionIds } from '../lib/mentions';
import { MentionText } from './MentionText';
import { MentionTextarea } from './MentionTextarea';

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
    toast.error(err.message);
    return;
  }
  toast.error(err instanceof Error ? err.message : fallback);
}

/**
 * Panel del hilo de comentarios dentro del detalle de tarea (QL-12, §3.9). El hilo se muestra
 * cronológico ascendente (más reciente abajo) con la caja de comentar al final. Deriva `canComment`
 * del rol por tarea (CREATOR/ASSIGNEE/COLLABORATOR) y solo permite editar/borrar comentarios propios
 * (`comment.authorId === user.id`), sin pintar controles que darían 403.
 */
export function CommentsPanel({ task }: CommentsPanelProps) {
  const role = task.currentUserRole;
  const canComment =
    role === 'CREATOR' || role === 'ASSIGNEE' || role === 'COLLABORATOR';
  const currentUserId = useAuthStore((s) => s.user?.id);

  const { data: comments, isLoading, isError, error } = useComments(task.id);
  const addComment = useAddComment(task.id);

  const [draft, setDraft] = useState('');
  // Candidatos de mención elegidos en el picker. Se filtran al enviar por si el usuario
  // borró el `@Nombre` del texto (ver `resolveMentionIds`).
  const mentionCandidates = useRef<CommentMention[]>([]);

  const registerMention = useCallback((mention: CommentMention) => {
    if (!mentionCandidates.current.some((m) => m.id === mention.id)) {
      mentionCandidates.current.push(mention);
    }
  }, []);

  const total = comments?.length ?? 0;

  const handleSubmit = () => {
    const body = draft.trim();
    if (!body || addComment.isPending) return;
    const mentions = resolveMentionIds(body, mentionCandidates.current);
    addComment.mutate(
      { body, mentions: mentions.length ? mentions : undefined },
      {
        onSuccess: () => {
          setDraft('');
          mentionCandidates.current = [];
        },
        onError: (err) => notifyError(err, 'No se pudo publicar el comentario'),
      },
    );
  };

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

      {canComment && !isError && (
        <div className="mt-4 space-y-2">
          <MentionTextarea
            value={draft}
            onChange={setDraft}
            onMention={registerMention}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Escribe un comentario… usa @ para mencionar"
            rows={3}
            disabled={addComment.isPending}
          />
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              onClick={handleSubmit}
              disabled={!draft.trim() || addComment.isPending}
            >
              {addComment.isPending ? <Loader2 className="animate-spin" /> : <Send />}
              Comentar
            </Button>
          </div>
        </div>
      )}

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

/** Un comentario del hilo: avatar + autor + fecha (+ "editado") + cuerpo, con edición/borrado si es propio. */
function CommentItem({ comment, taskId, isOwn }: CommentItemProps) {
  const updateComment = useUpdateComment(taskId);
  const deleteComment = useDeleteComment(taskId);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Menciones ya presentes en el comentario + las nuevas elegidas en esta edición. Se
  // reenvía el set completo válido (§3.9: PATCH recibe el nuevo set completo).
  const mentionCandidates = useRef<CommentMention[]>([]);

  const registerMention = useCallback((mention: CommentMention) => {
    if (!mentionCandidates.current.some((m) => m.id === mention.id)) {
      mentionCandidates.current.push(mention);
    }
  }, []);

  const authorName = comment.author?.name ?? 'Usuario';

  const startEdit = () => {
    setDraft(comment.body);
    // Siembra los candidatos con las menciones ya pobladas del comentario.
    mentionCandidates.current = [...comment.mentions];
    setEditing(true);
  };

  const commitEdit = () => {
    const body = draft.trim();
    if (!body || body === comment.body) {
      setEditing(false);
      return;
    }
    const mentions = resolveMentionIds(body, mentionCandidates.current);
    updateComment.mutate(
      { id: comment.id, data: { body, mentions } },
      {
        onSuccess: () => {
          setEditing(false);
          toast.success('Comentario actualizado');
        },
        onError: (err) => notifyError(err, 'No se pudo editar el comentario'),
      },
    );
  };

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

          {isOwn && !editing && (
            <div className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover/comment:opacity-100 focus-within:opacity-100">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={startEdit}
                aria-label="Editar comentario"
              >
                <Pencil className="size-3.5" />
              </Button>
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

        {editing ? (
          <div className="mt-1.5 space-y-2">
            <MentionTextarea
              autoFocus
              value={draft}
              onChange={setDraft}
              onMention={registerMention}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  commitEdit();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setEditing(false);
                }
              }}
              rows={3}
              disabled={updateComment.isPending}
            />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={commitEdit}
                disabled={updateComment.isPending}
              >
                {updateComment.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Check />
                )}
                Guardar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEditing(false)}
                disabled={updateComment.isPending}
              >
                <X />
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-0.5 text-sm break-words whitespace-pre-wrap text-on-surface">
            <MentionText body={comment.body} mentions={comment.mentions} />
          </p>
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
            <AlertDialogTitle>Eliminar comentario</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Seguro que quieres eliminar este comentario? Esta acción no se puede
              deshacer.
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
