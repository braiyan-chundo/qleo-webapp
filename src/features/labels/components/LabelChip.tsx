import { cn } from '@/lib/utils';
import { labelPill } from '@/features/tasks/lib/palette';

import type { Label } from '../services/labels.service';
import { resolveLabelIcon } from '../lib/label-icons';

interface LabelChipProps {
  label: Label;
  /** `sm` para cards/listas compactas; `md` para cabeceras. Por defecto `sm`. */
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Chip visual de una etiqueta (QL-146): **icono lucide + color Material 3**. Es el render
 * único de una etiqueta en todo el producto (card del board, lista, detalle, pickers), para
 * que un cambio de estilo sea un solo sitio. El color sale de la paleta compartida (`labelPill`,
 * tokens M3, **sin hex**); el icono se resuelve por su clave con fallback genérico.
 */
export function LabelChip({ label, size = 'sm', className }: LabelChipProps) {
  const Icon = resolveLabelIcon(label.icon);
  const pill = labelPill(label.color ?? 'gray', 0);

  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded font-semibold',
        size === 'sm'
          ? 'px-1.5 py-0.5 text-[10px] tracking-wide uppercase'
          : 'px-2 py-1 text-xs',
        pill,
        className,
      )}
      title={label.name}
    >
      <Icon className={cn('shrink-0', size === 'sm' ? 'size-3' : 'size-3.5')} />
      <span className="truncate">{label.name}</span>
    </span>
  );
}
