import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { SAFETY_NET_POLL_MS } from '@/core/query/query-client';

import { attachmentKeys } from '@/features/attachments/hooks/use-attachments';

import { commentsService, type CreateCommentPayload } from '../services/comments.service';

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

/**
 * Hilo de comentarios de una tarea (createdAt asc, `author` poblado). Solo corre si hay taskId.
 * (QL-133) Los comentarios nuevos llegan en vivo por el bus `/realtime` (`entity: 'comment'`);
 * el poll queda de red de seguridad.
 */
export function useComments(taskId: string | undefined) {
  return useQuery({
    queryKey: commentKeys.list(taskId ?? ''),
    queryFn: () => commentsService.list(taskId as string),
    enabled: !!taskId,
    refetchInterval: SAFETY_NET_POLL_MS,
    refetchOnWindowFocus: true,
  });
}

/**
 * Publica un comentario e invalida el hilo de la tarea. Solo CREATOR/ASSIGNEE/COLLABORATOR.
 *
 * (QL-174) Si el comentario referencia adjuntos (`attachmentIds`), esos ficheros son adjuntos
 * de la **tarea**: se invalida también la lista de adjuntos para que el panel de la tarea los
 * refleje sin recargar.
 */
export function useAddComment(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCommentPayload) => commentsService.create(taskId, data),
    onSuccess: (_comment, variables) => {
      queryClient.invalidateQueries({ queryKey: commentKeys.list(taskId) });
      if (variables.attachmentIds?.length) {
        queryClient.invalidateQueries({ queryKey: attachmentKeys.list(taskId) });
      }
    },
  });
}

/**
 * Elimina un comentario propio e invalida el hilo. Solo el autor. (QL-174) **No** borra los
 * adjuntos referenciados: son de la tarea y siguen en su panel (consecuencia aceptada del
 * modelo de adjuntos por tarea). (QL-176) No existe hook de edición: el backend responde
 * siempre 403 `COMMENT_NOT_EDITABLE`.
 */
export function useDeleteComment(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => commentsService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentKeys.list(taskId) });
    },
  });
}
