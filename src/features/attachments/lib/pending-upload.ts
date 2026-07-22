import type { Attachment } from '../services/attachments.service';

/**
 * (QL-174/QL-175) Adjunto **pendiente** de un composer: el archivo elegido (o pegado) mientras
 * sube, ya subido a la espera de enviarse, o fallido. Es estado **de UI**, no de servidor: vive
 * en el `useState` del composer hasta que el mensaje/comentario se publica.
 *
 * Compartido por el composer del Muro y el de comentarios de tarea para que ambos pinten el
 * mismo chip (`PendingAttachmentChip`) y se comporten igual.
 */
export interface PendingAttachment {
  /** Clave local estable (para el keyed render y para localizar el slot al parchearlo). */
  key: string;
  name: string;
  isImage: boolean;
  /** Object URL local del archivo (solo imágenes) para la miniatura previa. */
  previewUrl?: string;
  status: 'uploading' | 'done' | 'error';
  /** `Attachment` devuelto por la subida previa (presente si `status === 'done'`). */
  attachment?: Attachment;
}

let counter = 0;

/** Clave local única para un slot de subida (no es un id del servidor). */
export function nextPendingKey(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}
