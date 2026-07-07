import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { attachmentsService, type Attachment } from '../services/attachments.service';

/**
 * Hooks de datos del feature Adjuntos (QL-14, §3.11). Toda la interacción con la API pasa
 * por aquí; los componentes usan estos hooks y nunca llaman al service ni manejan
 * loading/error a mano. Sigue el patrón de `features/comments/hooks/use-comments.ts`.
 */

/** Claves de query del feature. Centralizadas para invalidación consistente. */
export const attachmentKeys = {
  all: ['attachments'] as const,
  lists: () => [...attachmentKeys.all, 'list'] as const,
  list: (taskId: string) => [...attachmentKeys.lists(), taskId] as const,
  projectLists: () => [...attachmentKeys.all, 'project-list'] as const,
  projectList: (projectId: string) =>
    [...attachmentKeys.projectLists(), projectId] as const,
};

/** Adjuntos de una tarea (`createdAt` desc, `uploadedBy` poblado). Solo corre si hay taskId. */
export function useAttachments(taskId: string | undefined) {
  return useQuery({
    queryKey: attachmentKeys.list(taskId ?? ''),
    queryFn: () => attachmentsService.list(taskId as string),
    enabled: !!taskId,
  });
}

/** Sube un archivo (multipart) e invalida la lista. Solo CREATOR/ASSIGNEE/COLLABORATOR. */
export function useUploadAttachment(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => attachmentsService.upload(taskId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attachmentKeys.list(taskId) });
    },
  });
}

/** Elimina un adjunto e invalida la lista. Solo el autor o el CREATOR de la tarea. */
export function useDeleteAttachment(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => attachmentsService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attachmentKeys.list(taskId) });
    },
  });
}

/** Documentos del proyecto (§3.18, `scope='project'`). Solo corre si hay projectId. */
export function useProjectAttachments(projectId: string | undefined) {
  return useQuery({
    queryKey: attachmentKeys.projectList(projectId ?? ''),
    queryFn: () => attachmentsService.listByProject(projectId as string),
    enabled: !!projectId,
  });
}

/** Sube un documento al proyecto (multipart) e invalida su lista. Solo ADMIN o creador (§3.18). */
export function useUploadProjectAttachment(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => attachmentsService.uploadToProject(projectId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attachmentKeys.projectList(projectId) });
    },
  });
}

/**
 * Elimina un documento de proyecto e invalida su lista (§3.18). Mismo endpoint que el borrado
 * de adjuntos de tarea; solo cambia la key que se invalida (la del proyecto).
 */
export function useDeleteProjectAttachment(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => attachmentsService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attachmentKeys.projectList(projectId) });
    },
  });
}

/**
 * Descarga el binario protegido (fetch con token → blob → `<a download>`). Es una acción
 * puntual, no una query cacheable, por eso es una mutación (sin invalidación). Expone
 * `isPending` para deshabilitar el botón mientras baja.
 */
export function useDownloadAttachment() {
  return useMutation({
    mutationFn: (attachment: Attachment) => attachmentsService.download(attachment),
  });
}
