import { api, ApiError } from '@/core/api/fetch-client';
import { useAuthStore } from '@/store/auth.store';

/** Autor poblado de un adjunto (§3.11). Superficie mínima según el DTO del backend. */
export interface AttachmentUploader {
  id: string;
  name: string;
  avatarUrl?: string;
  /** QL-32: proxy privado del avatar subido, o `null` si no hay. */
  avatarDownloadUrl?: string | null;
}

/**
 * Alcance de un adjunto (§3.18). `'task'` cuelga de una tarea (permisos por rol de tarea);
 * `'project'` es un documento general del proyecto (permisos de proyecto).
 */
export type AttachmentScope = 'task' | 'project';

/** DTO de respuesta del backend para un adjunto (QL-14 §3.11, QL-41 §3.18). */
export interface Attachment {
  id: string;
  /**
   * `'task'` para adjuntos de tarea, `'project'` para documentos de proyecto (§3.18).
   * Puede faltar en respuestas antiguas; asume `'task'` si viene ausente.
   */
  scope?: AttachmentScope;
  /** Tarea a la que pertenece, o `null` para documentos de proyecto (`scope='project'`). */
  taskId: string | null;
  /** Proyecto al que pertenece (siempre presente en documentos de proyecto). */
  projectId?: string | null;
  /** Nombre original del archivo (para mostrar y para el `download` del `<a>`). */
  originalName: string;
  /** Tipo MIME real validado por el backend contra la lista blanca. */
  mimeType: string;
  /** Tamaño en **bytes**. */
  size: number;
  uploadedBy: AttachmentUploader;
  createdAt: string;
  /**
   * Ruta relativa del endpoint de descarga (p.ej. `/attachments/:id/download`).
   * **Requiere `Authorization: Bearer`** → NO sirve como `href` plano; se descarga con
   * `download()` (fetch + blob).
   */
  downloadUrl: string;
}

/**
 * Base URL de la API, replicando la resolución del `fetch-client` (`api`). El cliente HTTP
 * estándar no expone su `baseUrl`, así que la derivamos igual aquí para las peticiones que
 * NO pueden usar `api`: subida multipart (sin `Content-Type` manual) y descarga binaria
 * (`res.blob()` en vez de JSON).
 */
const BASE_URL = import.meta.env.VITE_QLEO_API_BASE_URL || '/api';

/** Lee el token de la sesión (Zustand). Fuera de React, por eso `getState()`. */
function authHeader(): Record<string, string> {
  const token = useAuthStore.getState().accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Traduce una respuesta HTTP fallida (envuelta en `{ success, data, error }`) al mismo
 * `ApiError` que emite el `fetch-client`, para que los componentes reaccionen a `err.code`
 * (`FILE_TOO_LARGE`, `UNSUPPORTED_FILE_TYPE`, `READ_ONLY_ROLE`) igual que con `api`.
 */
async function toApiError(response: Response): Promise<ApiError> {
  const result = await response.json().catch(() => null);
  const message = result?.error?.message || response.statusText || 'Error desconocido';
  const code = result?.error?.code ?? null;
  return new ApiError(message, code, response.status);
}

/** Maneja el 401 global igual que el `fetch-client` (cierra sesión y manda al login). */
function handleUnauthorized(status: number) {
  if (status === 401) {
    useAuthStore.getState().logout();
    window.location.href = '/login';
  }
}

/**
 * Dispara la descarga de un `blob` en el navegador: crea un `<a download>` temporal,
 * hace click y revoca el object URL. Evita fugas de memoria del `createObjectURL`.
 */
function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export const attachmentsService = {
  /** Adjuntos de la tarea (`createdAt` desc, `uploadedBy` poblado). Cualquier participante. */
  list: (taskId: string) => {
    // Este GET devuelve JSON envuelto → usa el `api` estándar.
    return api.get<Attachment[]>(`/tasks/${taskId}/attachments`);
  },

  /**
   * Sube un archivo con `multipart/form-data` (campo `file`). Usa `fetch` manual porque el
   * `api` fuerza `Content-Type: application/json`; en multipart el navegador debe poner el
   * `boundary`, así que **no** seteamos `Content-Type` a mano.
   */
  upload: async (taskId: string, file: File): Promise<Attachment> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${BASE_URL}/tasks/${taskId}/attachments`, {
      method: 'POST',
      headers: authHeader(),
      body: formData,
    });

    if (!response.ok) {
      handleUnauthorized(response.status);
      throw await toApiError(response);
    }

    const result = await response.json().catch(() => null);
    return (result?.data ?? result) as Attachment;
  },

  /** Documentos de un proyecto (`scope='project'`, `createdAt` desc). Cualquier autenticado (§3.18). */
  listByProject: (projectId: string) => {
    return api.get<Attachment[]>(`/projects/${projectId}/attachments`);
  },

  /**
   * Sube un documento general al proyecto (`multipart/form-data`, campo `file`). ADMIN o
   * creador del proyecto (§3.18). Mismo motivo que `upload` para el `fetch` manual.
   */
  uploadToProject: async (projectId: string, file: File): Promise<Attachment> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${BASE_URL}/projects/${projectId}/attachments`, {
      method: 'POST',
      headers: authHeader(),
      body: formData,
    });

    if (!response.ok) {
      handleUnauthorized(response.status);
      throw await toApiError(response);
    }

    const result = await response.json().catch(() => null);
    return (result?.data ?? result) as Attachment;
  },

  /**
   * Elimina un adjunto (registro + binario). Mismo endpoint para tarea y proyecto (§3.18);
   * el backend ramifica el permiso por `scope`.
   */
  remove: (id: string) => {
    return api.delete<Attachment>(`/attachments/${id}`);
  },

  /**
   * Descarga el binario protegido: `fetch` con el token → `res.blob()` → `<a download>`
   * con el nombre original. El `downloadUrl` no lleva token, por eso no puede ser un
   * `href` plano (§3.11).
   */
  download: async (attachment: Attachment): Promise<void> => {
    const response = await fetch(`${BASE_URL}${attachment.downloadUrl}`, {
      method: 'GET',
      headers: authHeader(),
    });

    if (!response.ok) {
      handleUnauthorized(response.status);
      throw await toApiError(response);
    }

    const blob = await response.blob();
    triggerBlobDownload(blob, attachment.originalName);
  },
};
