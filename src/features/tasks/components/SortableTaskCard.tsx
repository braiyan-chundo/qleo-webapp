import { useEffect, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { cn } from '@/lib/utils';

import type { Task } from '../services/tasks.service';
import { canMoveTask } from '../lib/roles';
import { TaskCard } from './TaskCard';

interface SortableTaskCardProps {
  task: Task;
  onClick: () => void;
}

/**
 * Envuelve una `TaskCard` con `useSortable` (QL-15). La card es arrastrable solo si el rol
 * por tarea lo permite (`canMoveTask`); para OBSERVER/no-participante se desactiva el drag
 * pero sigue clickable (abre la tarea). El click no se roba al drag porque el `PointerSensor`
 * del board usa un `activationConstraint` de distancia (6px).
 *
 * (QL-123) Desde que el click **navega** a la vista de tarea (antes abría un modal), un click
 * fantasma tras soltar una tarjeta sería mucho más molesto: sacaría al usuario del tablero.
 * Por eso guardamos con un ref si hubo arrastre y, si lo hubo, tragamos el `click` que algunos
 * navegadores emiten en el `pointerup` final. El ref se resetea en la fase de captura del
 * `pointerdown` (no en el prop `onPointerDown`, que pertenece a los `listeners` de dnd-kit y
 * no debemos pisar), así que el siguiente click legítimo siempre pasa.
 */
export function SortableTaskCard({ task, onClick }: SortableTaskCardProps) {
  const draggable = canMoveTask(task.currentUserRole);
  const draggedRef = useRef(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    // Guarda la columna en `data` para resolver el destino al soltar en zona vacía.
    data: { type: 'task', columnId: task.columnId },
    disabled: !draggable,
  });

  useEffect(() => {
    if (isDragging) draggedRef.current = true;
  }, [isDragging]);

  function handleClick() {
    if (draggedRef.current) return;
    onClick();
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('touch-none', isDragging && 'opacity-40')}
      onPointerDownCapture={() => {
        draggedRef.current = false;
      }}
      {...(draggable ? attributes : {})}
      {...(draggable ? listeners : {})}
    >
      <TaskCard task={task} onClick={handleClick} />
    </div>
  );
}
