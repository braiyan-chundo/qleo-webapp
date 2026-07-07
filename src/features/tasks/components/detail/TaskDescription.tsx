import { cn } from '@/lib/utils';

interface TaskDescriptionProps {
  description?: string;
  /**
   * Recorta la descripción a un máximo de líneas (vistazo rápido del modal). Sin recorte
   * en la vista completa de la página.
   */
  clamp?: boolean;
  className?: string;
}

/**
 * Bloque "Descripción" del detalle de una tarea (QL-25). Compartido por la página y el modal:
 * la página lo muestra completo; el modal lo recorta (`clamp`) como vistazo rápido.
 */
export function TaskDescription({
  description,
  clamp = false,
  className,
}: TaskDescriptionProps) {
  const text = description?.trim();

  return (
    <div
      className={cn(
        'rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-4 py-3',
        className,
      )}
    >
      <p className="text-xs font-medium text-on-surface-variant">Descripción</p>
      <p
        className={cn(
          'mt-1 text-sm whitespace-pre-wrap text-on-surface',
          clamp && 'line-clamp-3',
        )}
      >
        {text || 'Sin descripción.'}
      </p>
    </div>
  );
}
