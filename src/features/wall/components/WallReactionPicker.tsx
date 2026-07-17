import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Plus } from 'lucide-react';

import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import { QUICK_REACTIONS } from '../lib/emojis';
import { EmojiGrid } from './EmojiGrid';

interface WallReactionPickerProps {
  /** Popover **controlado**: lo abre el hover-trigger (desktop) o el long-press (móvil) del mensaje. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Emoji con el que YA reaccionó el usuario (se resalta en la barra rápida), o `null`. */
  activeEmoji: string | null;
  /** Elige un emoji (toggle con reemplazo). El cierre del popover lo hace el llamador. */
  onSelect: (emoji: string) => void;
  /** Alineación del popover respecto a la burbuja (según sea propio → `end`, o ajeno → `start`). */
  align?: 'start' | 'center' | 'end';
  /** La burbuja del mensaje: sirve de ancla de posición del popover (`PopoverAnchor`). */
  children: ReactNode;
}

/**
 * (QL-147, §3.42) Selector de reacción estilo WhatsApp anclado a la burbuja: una **barra rápida**
 * de ~6 emojis comunes (`QUICK_REACTIONS`) + un botón **"+"** que la expande al picker ampliado
 * ("más emojis", `EmojiGrid` categorizado). Es un `Popover` controlado por el llamador; la burbuja
 * se pasa como `children` y actúa de `PopoverAnchor`.
 */
export function WallReactionPicker({
  open,
  onOpenChange,
  activeEmoji,
  onSelect,
  align = 'center',
  children,
}: WallReactionPickerProps) {
  const [expanded, setExpanded] = useState(false);

  // Al cerrar, vuelve a la barra rápida para la próxima apertura (no reabrir en modo "ampliado").
  useEffect(() => {
    if (!open) setExpanded(false);
  }, [open]);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>{children}</PopoverAnchor>
      <PopoverContent
        align={align}
        side="top"
        className={cn('w-auto max-w-[min(20rem,90vw)] p-1.5', expanded && 'w-72 p-2')}
      >
        {expanded ? (
          <EmojiGrid onSelect={onSelect} />
        ) : (
          <div className="flex items-center gap-0.5">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={`Reaccionar con ${emoji}`}
                aria-pressed={emoji === activeEmoji}
                onClick={() => onSelect(emoji)}
                className={cn(
                  'flex size-9 items-center justify-center rounded-full text-xl transition-colors hover:bg-surface-container-high',
                  emoji === activeEmoji && 'bg-secondary-container',
                )}
              >
                <span aria-hidden>{emoji}</span>
              </button>
            ))}
            <button
              type="button"
              aria-label="Más emojis"
              onClick={() => setExpanded(true)}
              className="flex size-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high"
            >
              <Plus className="size-5" />
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
