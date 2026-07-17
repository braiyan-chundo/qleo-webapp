import { useState } from 'react';

import { cn } from '@/lib/utils';

import { EMOJI_CATEGORIES } from '../lib/emojis';

interface EmojiGridProps {
  /** Selecciona un emoji (literal Unicode). El cierre/apertura lo gestiona quien la envuelve. */
  onSelect: (emoji: string) => void;
  className?: string;
}

/**
 * Rejilla de emojis **categorizada, sin red ni popover** (QL-90/QL-147): pestañas de categoría +
 * grid de la categoría activa. Es presentacional (no decide su apertura). La reusan el picker del
 * composer (`EmojiPicker`, inserta en el `body`) y el picker de reacciones ampliado del muro
 * (`WallReactionPicker`, "más emojis"). Son literales Unicode → respeta CSP/offline y no engorda
 * el bundle con librerías de emojis.
 */
export function EmojiGrid({ onSelect, className }: EmojiGridProps) {
  const [category, setCategory] = useState(0);
  const active = EMOJI_CATEGORIES[category];

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/* Pestañas de categoría */}
      <div className="flex items-center gap-0.5 border-b border-outline-variant/40 pb-1.5">
        {EMOJI_CATEGORIES.map((cat, index) => (
          <button
            key={cat.label}
            type="button"
            onClick={() => setCategory(index)}
            aria-label={cat.label}
            aria-pressed={index === category}
            className={cn(
              'flex size-8 items-center justify-center rounded-md text-lg transition-colors',
              index === category
                ? 'bg-secondary-container'
                : 'hover:bg-surface-container-high',
            )}
          >
            <span aria-hidden>{cat.icon}</span>
          </button>
        ))}
      </div>

      {/* Rejilla de emojis de la categoría activa */}
      <div
        role="listbox"
        aria-label={active.label}
        className="grid max-h-48 grid-cols-8 gap-0.5 overflow-y-auto pt-1"
      >
        {active.emojis.map((emoji, index) => (
          <button
            key={`${emoji}-${index}`}
            type="button"
            role="option"
            aria-selected={false}
            onClick={() => onSelect(emoji)}
            className="flex size-8 items-center justify-center rounded-md text-xl transition-colors hover:bg-surface-container-high"
          >
            <span aria-hidden>{emoji}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
