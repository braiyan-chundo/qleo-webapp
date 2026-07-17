import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  PALETTE_KEYS,
  paletteDot,
  type PaletteKey,
} from '@/features/tasks/lib/palette';

import type { LabelColor } from '../services/labels.service';

interface LabelColorPickerProps {
  value: LabelColor;
  onChange: (value: LabelColor) => void;
}

/** Etiquetas accesibles de cada color de la paleta compartida. */
const COLOR_LABEL: Record<PaletteKey, string> = {
  blue: 'Azul',
  orange: 'Naranja',
  green: 'Verde',
  purple: 'Morado',
  red: 'Rojo',
  pink: 'Rosa',
  gray: 'Gris',
};

/**
 * Selector de color de una etiqueta (QL-146): swatches de la **misma paleta M3** que columnas
 * y proyectos (tokens, sin hex). A diferencia del color de proyecto, aquí el color es
 * **obligatorio** (el backend aplica `gray` por defecto), así que no hay opción "sin color".
 */
export function LabelColorPicker({ value, onChange }: LabelColorPickerProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="radiogroup"
      aria-label="Color de la etiqueta"
    >
      {PALETTE_KEYS.map((key) => {
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={COLOR_LABEL[key]}
            title={COLOR_LABEL[key]}
            onClick={() => onChange(key)}
            className={cn(
              'flex size-7 items-center justify-center rounded-full transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              paletteDot(key),
              selected &&
                'ring-2 ring-primary ring-offset-2 ring-offset-surface-container-lowest',
            )}
          >
            {selected && <Check className="size-4 text-white" />}
          </button>
        );
      })}
    </div>
  );
}
