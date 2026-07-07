import { Check, Ban } from 'lucide-react';

import { cn } from '@/lib/utils';
import { PALETTE_KEYS, paletteDot, type PaletteKey } from '@/features/tasks/lib/palette';

import type { ProjectColor } from '../types/project';

interface ProjectColorPickerProps {
  /** Color seleccionado, o `''` para "sin color". */
  value: ProjectColor | '';
  onChange: (value: ProjectColor | '') => void;
}

/** Etiquetas accesibles de cada color de la paleta. */
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
 * Selector de color del proyecto (QL-29): swatches de la paleta compartida (tokens M3,
 * sin hex) + opción "sin color". El valor se maneja como `''` para "sin color" y se mapea
 * a `null` en el payload del formulario.
 */
export function ProjectColorPicker({ value, onChange }: ProjectColorPickerProps) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Color del proyecto">
      <button
        type="button"
        role="radio"
        aria-checked={value === ''}
        aria-label="Sin color"
        title="Sin color"
        onClick={() => onChange('')}
        className={cn(
          'flex size-7 items-center justify-center rounded-full border border-outline-variant/60 text-on-surface-variant transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
          value === '' && 'ring-2 ring-primary ring-offset-2 ring-offset-surface-container-lowest',
        )}
      >
        <Ban className="size-4" />
      </button>

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
              selected && 'ring-2 ring-primary ring-offset-2 ring-offset-surface-container-lowest',
            )}
          >
            {selected && <Check className="size-4 text-white" />}
          </button>
        );
      })}
    </div>
  );
}
