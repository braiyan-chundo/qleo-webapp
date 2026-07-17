import type { WallMessage, WallReplyPreview } from '../types/wall.types';
import type { WallFeedItem } from './wall-feed';
import { isAudioAttachment } from './wall-audio';

/** Longitud máxima del extracto de la cita, alineada con el backend (≤120 chars, QL-103). */
const PREVIEW_MAX = 120;

/**
 * Construye la **vista reducida** de un mensaje para citarlo al responder (QL-103). Reproduce
 * la lógica del `preview` del backend para el quote inmediato (composer + optimista): texto
 * recortado, o "🎤 Nota de voz" / "📎 Adjunto" si no hay texto, o el aviso de lápida. El backend
 * sigue siendo la fuente de verdad: en el feed llega ya resuelto en `WallMessage.replyTo`.
 */
export function buildReplyPreview(message: WallMessage | WallFeedItem): WallReplyPreview {
  // (QL-148) Solo se responde a mensajes de usuario (tienen autor); el fallback cubre el tipo
  // nullable del contrato sin que esta función pueda romper si algún día se cita algo sin autor.
  const author = message.author;
  return {
    id: message.id,
    author: author
      ? { id: author.id, name: author.name }
      : { id: message.authorId ?? '', name: 'Sistema' },
    preview: derivePreview(message),
  };
}

function derivePreview(message: WallMessage | WallFeedItem): string {
  if (message.deleted) return 'Este mensaje fue eliminado';
  const body = message.body.trim();
  if (body.length > 0) {
    return body.length > PREVIEW_MAX ? `${body.slice(0, PREVIEW_MAX)}…` : body;
  }
  if (message.attachments.some(isAudioAttachment)) return '🎤 Nota de voz';
  if (message.attachments.length > 0) return '📎 Adjunto';
  return '';
}
