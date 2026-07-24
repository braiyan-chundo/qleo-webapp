import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { aiConversationsService } from '../services/ai-conversations.service';

/**
 * Hooks del **historial de conversaciones** de IA (QL-190, §3.63). Es dato de servidor normal → vive
 * en TanStack Query (a diferencia del stream de chat, que es estado local del feature).
 */

export const aiConversationKeys = {
  all: ['ai', 'conversations'] as const,
  lists: () => [...aiConversationKeys.all, 'list'] as const,
  detail: (id: string) => [...aiConversationKeys.all, 'detail', id] as const,
};

/** Lista de mis conversaciones (recientes primero). */
export function useAiConversations() {
  return useQuery({
    queryKey: aiConversationKeys.lists(),
    queryFn: () => aiConversationsService.list(),
  });
}

/** Detalle (con mensajes) de una conversación. Solo corre cuando hay `id`. */
export function useAiConversation(id: string | null) {
  return useQuery({
    queryKey: aiConversationKeys.detail(id ?? ''),
    queryFn: () => aiConversationsService.getById(id as string),
    enabled: !!id,
  });
}

/** Borra una conversación e invalida la lista. */
export function useDeleteAiConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => aiConversationsService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiConversationKeys.lists() });
    },
  });
}

/** Borra TODAS mis conversaciones e invalida la lista. */
export function useClearAiConversations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => aiConversationsService.removeAll(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiConversationKeys.lists() });
    },
  });
}
