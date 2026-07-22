import { api } from '@/core/api/fetch-client';
import type { Attachment } from '@/features/attachments/services/attachments.service';

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
  /**
   * **(QL-174)** Adjuntos del comentario, ya **expandidos** (`[]` si no hay). Son adjuntos de la
   * TAREA (`scope: 'task'`) referenciados desde el comentario: por eso salen también en el panel
   * de Adjuntos de la tarea y **borrar el comentario NO borra el archivo** (decisión de producto).
   */
  attachments: Attachment[];
}

/** Body para crear un comentario (§3.9). `mentions` = userIds @mencionados (QL-13). */
export interface CreateCommentPayload {
  /** **Obligatorio**: no existe el comentario solo-adjunto (decisión del cliente, QL-174). */
  body: string;
  mentions?: string[];
  /**
   * **(QL-174)** Ids de adjuntos **ya subidos** a la tarea (`POST /tasks/:taskId/attachments`)
   * que se referencian desde este comentario. Si alguno no es vinculable → 400
   * `COMMENT_ATTACHMENT_INVALID`.
   */
  attachmentIds?: string[];
}

export const commentsService = {
  list: (taskId: string) => {
    return api.get<Comment[]>(`/tasks/${taskId}/comments`);
  },

  create: (taskId: string, data: CreateCommentPayload) => {
    return api.post<Comment>(`/tasks/${taskId}/comments`, data);
  },

  /**
   * (QL-176) **No hay edición de comentarios**: el `PATCH /comments/:id` responde siempre 403
   * `COMMENT_NOT_EDITABLE`, así que el front ni lo ofrece ni lo llama. El **borrado** sigue igual.
   */
  remove: (id: string) => {
    return api.delete<Comment>(`/comments/${id}`);
  },
};
