import { cn } from '@/lib/utils';

import type { WallReplyPreview } from '../types/wall.types';

interface WallReplyQuoteProps {
  reply: WallReplyPreview;
  /** Salta/scrollea al mensaje original en el feed (si está cargado). */
  onJump?: (id: string) => void;
  className?: string;
}

/**
 * Cita del mensaje respondido pintada **encima del cuerpo** de una respuesta (QL-103, estilo
 * WhatsApp): barra lateral de color + autor en negrita + extracto. Es **clicable** → salta al
 * mensaje original en el feed (`onJump`); si no está cargado, el comportamiento es un no-op suave
 * (lo decide el llamador). El `preview` ya viene resuelto (texto recortado / "🎤 Nota de voz" /
 * "📎 Adjunto" / "Este mensaje fue eliminado").
 */
export function WallReplyQuote({ reply, onJump, className }: WallReplyQuoteProps) {
  return (
    <button
      type="button"
      onClick={() => onJump?.(reply.id)}
      className={cn(
        'flex w-full items-stretch gap-2 overflow-hidden rounded-md border-l-2 border-primary bg-surface-container-lowest/60 px-2 py-1 text-left transition-colors hover:bg-surface-container-lowest',
        className,
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold text-primary">
          {reply.author.name}
        </span>
        <span className="block truncate text-xs text-on-surface-variant">
          {reply.preview || 'Mensaje'}
        </span>
      </span>
    </button>
  );
}
