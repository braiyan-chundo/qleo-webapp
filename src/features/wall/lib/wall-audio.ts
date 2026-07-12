import type { Attachment } from '@/features/attachments/services/attachments.service';

/**
 * Utilidades de **notas de voz** del muro (QL-104, §3.25.2). Un adjunto de audio se detecta por
 * su `mimeType` (`audio/*`) o, defensivamente, por traer `durationSec` (solo lo llevan las notas
 * de voz). Se usa para pintar el reproductor y el preview de una respuesta a una nota de voz.
 */
export function isAudioAttachment(attachment: Attachment): boolean {
  return attachment.mimeType.startsWith('audio/') || attachment.durationSec != null;
}

/** Formatea una duración en segundos a `m:ss` (p. ej. 75 → "1:15"). Negativos/NaN → "0:00". */
export function formatVoiceDuration(totalSeconds: number | null | undefined): string {
  const seconds = Math.max(0, Math.floor(totalSeconds ?? 0));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${rest.toString().padStart(2, '0')}`;
}
