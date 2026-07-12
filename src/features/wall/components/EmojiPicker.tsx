import { useState } from 'react';
import { Smile } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import { EMOJI_CATEGORIES } from '../lib/emojis';

interface EmojiPickerProps {
  /** Inserta el emoji (literal Unicode) en el composer; el popover se cierra tras elegir. */
  onSelect: (emoji: string) => void;
  disabled?: boolean;
}

/**
 * Picker de emojis ligero y **sin red** (QL-90): un set curado de emojis Unicode organizados
 * por categorías, insertados como texto en el `body`. No usa librería externa ni descarga
 * datos en runtime (respeta CSP/offline y no engorda el bundle). Se apoya en el `Popover`
 * base (radix) ya presente en el proyecto.
 */
export function EmojiPicker({ onSelect, disabled }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState(0);

  const active = EMOJI_CATEGORIES[category];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={disabled}
          aria-label="Insertar emoji"
          className="size-9 shrink-0 text-on-surface-variant"
        >
          <Smile className="size-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-72 gap-2 p-2">
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
              onClick={() => {
                onSelect(emoji);
                setOpen(false);
              }}
              className="flex size-8 items-center justify-center rounded-md text-xl transition-colors hover:bg-surface-container-high"
            >
              <span aria-hidden>{emoji}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
