import { cn } from '@/lib/utils';

import { LABEL_ICONS } from '../lib/label-icons';

interface LabelIconPickerProps {
  /** Clave de icono seleccionada. */
  value: string;
  onChange: (key: string) => void;
}

/**
 * Picker de iconos del set **curado** de lucide (QL-146). Renderiza cada opción por su clave
 * (mapa clave→componente en `label-icons.ts`; sin import dinámico). La rejilla hace scroll si
 * no cabe, para no crecer el diálogo que la contiene.
 */
export function LabelIconPicker({ value, onChange }: LabelIconPickerProps) {
  return (
    <div
      className="grid max-h-40 grid-cols-8 gap-1 overflow-y-auto rounded-lg border border-outline-variant/60 p-2"
      role="radiogroup"
      aria-label="Icono de la etiqueta"
    >
      {LABEL_ICONS.map(({ key, label, Icon }) => {
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            title={label}
            onClick={() => onChange(key)}
            className={cn(
              'flex aspect-square items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              selected && 'bg-primary-container text-on-primary-container',
            )}
          >
            <Icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
}
