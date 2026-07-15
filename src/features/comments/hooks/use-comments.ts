import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  commentsService,
  type Comment,
  type CreateCommentPayload,
  type UpdateCommentPayload,
} from '../services/comments.service';

/**
 * Hooks de datos del feature Comentarios (QL-12, §3.9). Toda la interacción con la API pasa
 * por aquí; los componentes usan estos hooks y nunca llaman al service ni manejan loading/error
 * a mano. Sigue el patrón de `features/checklists/hooks/use-checklist.ts`.
 */

/** Claves de query del feature. Centralizadas para invalidación consistente. */
export const commentKeys = {
  all: ['comments'] as const,
  lists: () => [...commentKeys.all, 'list'] as const,
  list: (taskId: string) => [...commentKeys.lists(), taskId] as const,
};

/** (P8) Intervalo de sondeo del hilo (MVP = polling; comentarios de otras sesiones en vivo). */
const COMMENTS_POLL_MS = 15_000;

/**
 * Hilo de comentarios de una tarea (createdAt asc, `author` poblado). Solo corre si hay taskId.
 * Sondea cada ~15 s y al reenfocar la ventana para ver comentarios nuevos de otras sesiones (P8).
 */
export function useComments(taskId: string | undefined) {
  return useQuery({
    queryKey: commentKeys.list(taskId ?? ''),
    queryFn: () => commentsService.list(taskId as string),
    enabled: !!taskId,
    refetchInterval: COMMENTS_POLL_MS,
    refetchOnWindowFocus: true,
  });
}

/** Publica un comentario e invalida el hilo de la tarea. Solo CREATOR/ASSIGNEE/COLLABORATOR. */
export function useAddComment(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCommentPayload) => commentsService.create(taskId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentKeys.list(taskId) });
    },
  });
}

/**
 * Edita un comentario propio. La respuesta trae el comentario actualizado (con `editedAt`),
 * así que sembramos la caché con él además de invalidar. Solo el autor.
 */
export function useUpdateComment(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCommentPayload }) =>
      commentsService.update(id, data),
    onSuccess: (comment: Comment) => {
      queryClient.setQueryData<Comment[]>(commentKeys.list(taskId), (prev) =>
        prev?.map((c) => (c.id === comment.id ? { ...c, ...comment } : c)),
      );
      queryClient.invalidateQueries({ queryKey: commentKeys.list(taskId) });
    },
  });
}

/** Elimina un comentario propio e invalida el hilo. Solo el autor. */
export function useDeleteComment(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => commentsService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentKeys.list(taskId) });
    },
  });
}
