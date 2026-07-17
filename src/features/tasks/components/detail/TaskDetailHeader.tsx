import { CheckCircle2, Square } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LabelChip } from '@/features/labels/components/LabelChip';

import type { Task } from '../../services/tasks.service';
import { TASK_ROLE_BADGE_CLASS, TASK_ROLE_LABEL } from '../../lib/roles';

interface TaskDetailHeaderProps {
  task: Task;
  /** Nombre de la columna resuelto por el llamador (de `useColumns`). */
  columnName?: string;
  /**
   * Elemento que renderiza el título (para usar `DialogTitle` en el modal o un `<h1>` en la
   * página). Por defecto un `<h2>`. Recibe las clases de tipografía del título.
   */
  titleAs?: 'h1' | 'h2';
  className?: string;
}

/**
 * Cabecera compartida del detalle de una tarea (QL-25): título, badges (completada / mi rol)
 * y la línea de columna. La usan tanto la página dedicada (`TaskDetailPage`) como el modal de
 * vistazo rápido (`TaskDetailDialog`), evitando duplicar el markup del encabezado.
 */
export function TaskDetailHeader({
  task,
  columnName,
  titleAs = 'h2',
  className,
}: TaskDetailHeaderProps) {
  const TitleTag = titleAs;

  return (
    <div className={className}>
      <div className="flex items-start justify-between gap-3">
        <TitleTag className="text-xl font-semibold text-on-surface">
          {task.title}
        </TitleTag>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {task.isCompleted && (
            <Badge className="bg-tertiary-container text-on-tertiary-container">
              <CheckCircle2 className="size-3.5" />
              Completada
            </Badge>
          )}
          {task.currentUserRole && (
            <Badge className={cn(TASK_ROLE_BADGE_CLASS[task.currentUserRole])}>
              Tu rol: {TASK_ROLE_LABEL[task.currentUserRole]}
            </Badge>
          )}
        </div>
      </div>

      {(columnName || task.labels[0]) && (
        <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-on-surface-variant">
          {columnName && (
            <span className="inline-flex items-center gap-1">
              <Square className="size-3.5" />
              {columnName}
            </span>
          )}
          {task.labels[0] && <LabelChip label={task.labels[0]} size="md" />}
        </div>
      )}
    </div>
  );
}
