import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, MessageSquare, Trash2 } from 'lucide-react';

import { ApiError } from '@/core/api/fetch-client';
import type { TaskRole } from '@/features/tasks/services/tasks.service';
import { hasAtLeastRole } from '@/shared/lib/permissions';
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

/**
 * Traduce cualquier fallo de comentarios a un toast (§3.9).
 *
 * (QL-196, §3.68) **Ya no se trata `READ_ONLY_ROLE`**: desde que el Observador puede comentar,
 * `POST /tasks/:taskId/comments` no lo emite — el único rechazo posible es el 403 genérico de
 * Nest ("No participas en esta tarea."), que se pinta tal cual con `err.message`.
 */
function notifyError(err: unknown, fallback: string) {
  if (err instanceof ApiError) {
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
 * cronológico ascendente (más reciente abajo) con la caja de comentar al final.
 *
 * (QL-196, §3.68) **Quién puede comentar** son dos vías independientes, y basta con una:
 * participar en la tarea con **cualquiera** de los cuatro roles (el `OBSERVER` incluido, que
 * antes se excluía a mano) **o** ser Dirección (`hasAtLeastRole(user,'MANAGER')`).
 *
 * ⚠️ La segunda vía **no** se puede leer de `currentUserRole`: el contrato dice explícitamente
 * que ese campo NO cambió, así que un gerente que comenta una tarea ajena sigue recibiendo
 * `null`. Condicionar solo por `currentUserRole !== null` le escondería la caja aunque la API le
 * deje escribir. Y comentar tampoco lo mete en `assignments`: seguirá siendo `null` después.
 *
 * (QL-176) **Un comentario no se edita**: solo se puede **eliminar** el propio. (QL-174) Cada
 * comentario puede traer adjuntos, que se abren en el visor compartido. (QL-173) Los cuerpos
 * largos se recortan con "Leer más".
 */
export function CommentsPanel({ task }: CommentsPanelProps) {
  const currentUser = useAuthStore((s) => s.user);
  const currentUserId = currentUser?.id;
  /** ¿Participa en la tarea? Con cualquier rol; desde QL-196 el `OBSERVER` también comenta. */
  const isParticipant = task.currentUserRole !== null;
  const canComment = isParticipant || hasAtLeastRole(currentUser, 'MANAGER');

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

      {canComment && !isError && (
        <CommentComposer
          taskId={task.id}
          onError={notifyError}
          // (QL-196, §3.68) Límite conocido de la HU: adjuntar sigue exigiendo participar en la
          // tarea. Dirección comenta texto, pero el clip se retira para que no se coma un 403.
          canAttach={isParticipant}
        />
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
