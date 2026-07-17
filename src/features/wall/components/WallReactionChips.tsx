import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import type { WallReaction } from '../types/wall.types';

interface WallReactionChipsProps {
  /** Reacciones agrupadas por emoji (orden `count` desc que da el backend, QL-147). */
  reactions: WallReaction[];
  /** Id del usuario logueado, para resaltar la reacción propia (`userIds.includes`). */
  currentUserId?: string;
  /** Alterna la reacción a ese emoji (toggle con reemplazo): el mío lo quita, otro lo cambia. */
  onToggle: (emoji: string) => void;
  /** Texto del tooltip "quién reaccionó" (nombres resueltos vía directorio, "Tú" para el propio). */
  describeReactors: (userIds: string[]) => string;
  /** Alineación bajo la burbuja: `end` en mensajes propios (derecha), `start` en ajenos. */
  align: 'start' | 'end';
  /** Deshabilita los chips mientras hay una reacción en vuelo. */
  disabled?: boolean;
}

/**
 * (QL-147, §3.42) Chips de reacciones bajo un mensaje del muro, estilo WhatsApp: `{emoji count}`
 * por grupo, **resaltando** la propia. Tocar un chip que ya es mío lo quita; tocar otro lo cambia
 * (ambos casos → `onToggle(emoji)`, el backend hace el toggle con reemplazo). Cada chip lleva un
 * tooltip "quién reaccionó" con los nombres resueltos.
 */
export function WallReactionChips({
  reactions,
  currentUserId,
  onToggle,
  describeReactors,
  align,
  disabled,
}: WallReactionChipsProps) {
  if (reactions.length === 0) return null;

  return (
    <div
      className={cn(
        'flex flex-wrap gap-1 px-1',
        align === 'end' ? 'justify-end' : 'justify-start',
      )}
    >
      {reactions.map((reaction) => {
        const mine = !!currentUserId && reaction.userIds.includes(currentUserId);
        return (
          <Tooltip key={reaction.emoji}>
            <TooltipTrigger asChild>
              <button
                type="button"
                disabled={disabled}
                aria-pressed={mine}
                aria-label={`${reaction.emoji}, ${reaction.count}`}
                onClick={() => onToggle(reaction.emoji)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs tabular-nums transition-colors disabled:opacity-60',
                  mine
                    ? 'border-primary/40 bg-primary-container text-on-primary-container'
                    : 'border-outline-variant/60 bg-surface-container text-on-surface-variant hover:bg-surface-container-high',
                )}
              >
                <span aria-hidden className="text-sm leading-none">
                  {reaction.emoji}
                </span>
                <span>{reaction.count}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>{describeReactors(reaction.userIds)}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
