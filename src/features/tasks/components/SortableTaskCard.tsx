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
 * pero sigue clickable (abre el detalle). El click no se roba porque el `PointerSensor` del
 * board usa un `activationConstraint` de distancia.
 */
export function SortableTaskCard({ task, onClick }: SortableTaskCardProps) {
  const draggable = canMoveTask(task.currentUserRole);

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

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('touch-none', isDragging && 'opacity-40')}
      {...(draggable ? attributes : {})}
      {...(draggable ? listeners : {})}
    >
      <TaskCard task={task} onClick={onClick} />
    </div>
  );
}
