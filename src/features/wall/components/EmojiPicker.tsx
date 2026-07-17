import { useState } from 'react';
import { Smile } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { EmojiGrid } from './EmojiGrid';

interface EmojiPickerProps {
  /** Inserta el emoji (literal Unicode) en el composer; el popover se cierra tras elegir. */
  onSelect: (emoji: string) => void;
  disabled?: boolean;
}

/**
 * Picker de emojis del **composer** (QL-90): un botón que abre un `Popover` con la rejilla
 * categorizada (`EmojiGrid`), insertando el emoji elegido como texto en el `body`. Sin librería
 * externa ni red (respeta CSP/offline y no engorda el bundle).
 */
export function EmojiPicker({ onSelect, disabled }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);

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
        <EmojiGrid
          onSelect={(emoji) => {
            onSelect(emoji);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
