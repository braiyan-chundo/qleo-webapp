import { api } from '@/core/api/fetch-client';

/** Autor poblado de un comentario (§3.9). Puede venir ausente si el backend no lo puebla. */
export interface CommentAuthor {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  /** QL-32: proxy privado del avatar subido, o `null` si no hay. */
  avatarDownloadUrl?: string | null;
}

/**
 * Usuario @mencionado dentro de un comentario (QL-13, §3.9/§3.10). El backend puebla
 * `name` para poder resaltar el `@Nombre` en el hilo.
 */
export interface CommentMention {
  id: string;
  name: string;
  avatarUrl?: string;
}

/** DTO de respuesta del backend para un comentario (QL-12, §3.9). */
export interface Comment {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  /** ISO de la última edición, o `null` si nunca se editó. */
  editedAt: string | null;
  createdAt: string;
  author?: CommentAuthor;
  /** Usuarios @mencionados válidos, poblados (QL-13). `[]` si no hay. */
  mentions: CommentMention[];
}

/** Body para crear un comentario (§3.9). `mentions` = userIds @mencionados (QL-13). */
export interface CreateCommentPayload {
  body: string;
  mentions?: string[];
}

/**
 * Body para editar un comentario (§3.9). El backend setea `editedAt`. `mentions` es el
 * **nuevo set completo** de userIds; el backend solo notifica a los nuevos (QL-13).
 */
export interface UpdateCommentPayload {
  body: string;
  mentions?: string[];
}

export const commentsService = {
  list: (taskId: string) => {
    return api.get<Comment[]>(`/tasks/${taskId}/comments`);
  },

  create: (taskId: string, data: CreateCommentPayload) => {
    return api.post<Comment>(`/tasks/${taskId}/comments`, data);
  },

  update: (id: string, data: UpdateCommentPayload) => {
    return api.patch<Comment>(`/comments/${id}`, data);
  },

  remove: (id: string) => {
    return api.delete<Comment>(`/comments/${id}`);
  },
};
