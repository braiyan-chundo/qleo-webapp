import { toast } from 'sonner';

import { ApiError } from '@/core/api/fetch-client';
import { MAX_UPLOAD_LABEL } from '@/features/attachments/lib/files';

/**
 * Traduce cualquier fallo del Muro Corporativo (QL-90, §3.25) a un toast claro reaccionando
 * al `err.code`, no al texto. Cubre los códigos de negocio del muro y los de subida de
 * adjuntos (compartidos con §3.11):
 * - `WALL_MESSAGE_EMPTY` — mensaje sin body ni adjuntos.
 * - `WALL_ATTACHMENT_INVALID` — algún adjunto no es vinculable (ajeno / ya vinculado).
 * - `WALL_MESSAGE_NOT_EDITABLE` — editar sin ser el autor.
 * - `WALL_MESSAGE_NOT_AUTHOR` — (QL-102) borrar sin ser el autor (ni ADMIN puede).
 * - `WALL_MESSAGE_NOT_FOUND` — el mensaje ya no existe o fue borrado (o el `replyTo` citado).
 * - **(QL-170)** `WALL_EDIT_WINDOW_EXPIRED` / `WALL_DELETE_WINDOW_EXPIRED` — pasaron los 5 min
 *   desde `createdAt`. La UI ya deshabilita las acciones, pero el reloj del navegador puede ir
 *   adelantado respecto al del servidor: el toast explica por qué se rechazó.
 * - `FILE_TOO_LARGE` / `UNSUPPORTED_FILE_TYPE` — límites de la subida de adjuntos.
 */
export function notifyWallError(err: unknown, fallback: string) {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'WALL_MESSAGE_EMPTY':
        toast.error('Escribe un mensaje o adjunta un archivo.');
        return;
      case 'WALL_ATTACHMENT_INVALID':
        toast.error('No se pudo adjuntar el archivo. Vuelve a intentarlo.');
        return;
      case 'WALL_MESSAGE_NOT_EDITABLE':
        toast.error('No tienes permiso para modificar este mensaje.');
        return;
      case 'WALL_MESSAGE_NOT_AUTHOR':
        toast.error('Solo el autor puede eliminar este mensaje.');
        return;
      case 'WALL_MESSAGE_NOT_FOUND':
        toast.error('El mensaje ya no está disponible.');
        return;
      case 'WALL_EDIT_WINDOW_EXPIRED':
        toast.error('Ya no se puede editar: pasaron los 5 minutos desde que se envió.');
        return;
      case 'WALL_DELETE_WINDOW_EXPIRED':
        toast.error('Ya no se puede eliminar: pasaron los 5 minutos desde que se envió.');
        return;
      case 'FILE_TOO_LARGE':
        toast.error(`El archivo supera el límite de ${MAX_UPLOAD_LABEL}.`);
        return;
      case 'UNSUPPORTED_FILE_TYPE':
        toast.error('Tipo de archivo no permitido.');
        return;
      default:
        toast.error(err.message || fallback);
        return;
    }
  }
  toast.error(err instanceof Error ? err.message : fallback);
}
