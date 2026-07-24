import { api } from '@/core/api/fetch-client';

/**
 * Servicio del **historial de conversaciones** de IA (QL-190, §3.63). Son JSON normal (envuelto),
 * así que van por el `api` compartido y TanStack Query. Todo está acotado al dueño (tu `userId`):
 * nunca ves ni borras la conversación de otro (404 si no es tuya).
 */

/** Resumen de conversación (`GET /ai/conversations`). */
export interface AiConversationSummary {
  id: string;
  title: string;
  messageCount: number;
  updatedAt: string;
  createdAt: string;
}

/** Un mensaje persistido de una conversación (`GET /ai/conversations/:id`). */
export interface AiConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  /** Nombres de las herramientas usadas en ese turno (sin label; el detalle solo trae nombres). */
  toolsUsed: string[];
  createdAt: string;
}

/** Detalle de conversación con sus mensajes (`GET /ai/conversations/:id`). */
export interface AiConversationDetail {
  id: string;
  title: string;
  messages: AiConversationMessage[];
  createdAt: string;
  updatedAt: string;
}

export const aiConversationsService = {
  /** Mis conversaciones, recientes primero. */
  list: () => api.get<AiConversationSummary[]>('/ai/conversations'),

  /** Detalle (con mensajes) de una conversación mía. 404 si no es mía. */
  getById: (id: string) => api.get<AiConversationDetail>(`/ai/conversations/${id}`),

  /** Borra una conversación mía (204). */
  remove: (id: string) => api.delete<void>(`/ai/conversations/${id}`),

  /** Borra TODAS mis conversaciones. Devuelve cuántas se eliminaron. */
  removeAll: () => api.delete<{ deletedCount: number }>('/ai/conversations'),
};
