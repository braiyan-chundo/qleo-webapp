/**
 * Utilidades de cliente para adjuntos (QL-14, §3.11): formateo de tamaño, tipo de icono y
 * validación previa (tamaño / tipo). La validación aquí es solo para **feedback inmediato**;
 * el backend sigue siendo la fuente de verdad (devuelve `FILE_TOO_LARGE` / `UNSUPPORTED_FILE_TYPE`).
 */

import { toast } from 'sonner';

import { ApiError } from '@/core/api/fetch-client';

/** Límite de subida, alineado con `MAX_UPLOAD_BYTES` del backend (10 MB). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Lista blanca de tipos MIME permitidos (§3.11): PDF, imágenes, Office, texto y zip.
 * Se usa para el `accept` del input y para la validación previa en cliente.
 */
export const ALLOWED_MIME_TYPES: readonly string[] = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/zip',
];

/** Valor del atributo `accept` del `<input type="file">` (misma lista blanca). */
export const ACCEPT_ATTR = ALLOWED_MIME_TYPES.join(',');

/** Categoría de icono a pintar según el `mimeType`. */
export type AttachmentIconKind = 'image' | 'pdf' | 'file';

/** Deriva la categoría de icono desde el `mimeType` (imagen / PDF / archivo genérico). */
export function iconKindFor(mimeType: string): AttachmentIconKind {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  return 'file';
}

/** Formatea bytes a una cadena legible (B / KB / MB) con un decimal cuando aporta. */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb % 1 === 0 ? kb : kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb % 1 === 0 ? mb : mb.toFixed(1)} MB`;
}

/** Resultado de la validación previa en cliente. `code` refleja el del backend (§3.11). */
export type ClientValidationError =
  | { code: 'FILE_TOO_LARGE'; message: string }
  | { code: 'UNSUPPORTED_FILE_TYPE'; message: string };

/**
 * Valida tamaño y tipo antes de subir para dar feedback inmediato. Devuelve `null` si el
 * archivo pasa; si no, un error con el mismo `code` que usaría el backend. No sustituye la
 * validación del servidor (algunos navegadores no rellenan `file.type` de forma fiable).
 */
export function validateFile(file: File): ClientValidationError | null {
  if (file.size > MAX_UPLOAD_BYTES) {
    return { code: 'FILE_TOO_LARGE', message: 'El archivo supera el límite de 10 MB' };
  }
  // Si el navegador no reporta tipo, deja pasar y confía en el backend.
  if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
    return { code: 'UNSUPPORTED_FILE_TYPE', message: 'Tipo de archivo no permitido' };
  }
  return null;
}

/** ISO → antigüedad relativa breve en español (ej. "hace 5 min", "hace 2 h", "hace 3 d"). */
export function timeAgo(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'hace un momento';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days} d`;
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Traduce cualquier fallo de adjuntos a un toast según §3.11/§3.18: reacciona al `err.code`
 * (`FILE_TOO_LARGE` / `UNSUPPORTED_FILE_TYPE` / `READ_ONLY_ROLE`), no al texto.
 */
export function notifyAttachmentError(err: unknown, fallback: string) {
  if (err instanceof ApiError) {
    if (err.code === 'FILE_TOO_LARGE') {
      toast.error('El archivo supera el límite de 10 MB');
      return;
    }
    if (err.code === 'UNSUPPORTED_FILE_TYPE') {
      toast.error('Tipo de archivo no permitido');
      return;
    }
    if (err.code === 'READ_ONLY_ROLE') {
      toast.error('Tu rol es de solo lectura');
      return;
    }
    toast.error(err.message);
    return;
  }
  toast.error(err instanceof Error ? err.message : fallback);
}
