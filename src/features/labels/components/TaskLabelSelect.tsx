import { Ban } from 'lucide-react';

import { cn } from '@/lib/utils';
import { resolveLabelIcon } from '../lib/label-icons';
import { labelPill } from '@/features/tasks/lib/palette';

import type { Label } from '../services/labels.service';

interface TaskLabelSelectProps {
  /** Etiquetas disponibles = las adoptadas por el proyecto (`project.labels`). */
  labels: Label[];
  /** Id seleccionado, o `''` para "sin etiqueta". */
  value: string;
  onChange: (labelId: string) => void;
}

/**
 * Selector de **una sola** etiqueta para la tarea (QL-146, §3.38). Ofrece únicamente las
 * etiquetas del proyecto (`project.labels`): el backend rechaza cualquier otra con
 * `LABEL_NOT_IN_PROJECT`. El componente ya trabaja con un `value` escalar, pero el contenedor
 * envía `labelIds` como array (`[]` o `[id]`), dejando el modelo listo para múltiples.
 * Si el proyecto no tiene etiquetas, muestra un vacío explicativo.
 */
export function TaskLabelSelect({ labels, value, onChange }: TaskLabelSelectProps) {
  if (labels.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-outline-variant/60 px-3 py-2 text-xs text-on-surface-variant">
        Este proyecto no tiene etiquetas. Añádelas desde la edición del proyecto para poder
        usarlas en las tareas.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Etiqueta de la tarea">
      <button
        type="button"
        role="radio"
        aria-checked={value === ''}
        onClick={() => onChange('')}
        className={cn(
          'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
          value === ''
            ? 'border-primary bg-primary-container text-on-primary-container'
            : 'border-outline-variant/60 text-on-surface-variant hover:bg-surface-container-high',
        )}
      >
        <Ban className="size-3.5" />
        Sin etiqueta
      </button>

      {labels.map((label) => {
        const Icon = resolveLabelIcon(label.icon);
        const selected = value === label.id;
        return (
          <button
            key={label.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(selected ? '' : label.id)}
            title={label.name}
            className={cn(
              'inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              labelPill(label.color ?? 'gray', 0),
              selected &&
                'ring-2 ring-primary ring-offset-1 ring-offset-surface-container-lowest',
            )}
          >
            <Icon className="size-3.5 shrink-0" />
            <span className="truncate">{label.name}</span>
          </button>
        );
      })}
    </div>
  );
}
