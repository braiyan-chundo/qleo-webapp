import { Archive, BadgeCheck, CheckCircle2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LabelChip } from '@/features/labels/components/LabelChip';
import type { Column } from '@/features/columns/services/columns.service';

import type { Task } from '../../services/tasks.service';
import { TASK_ROLE_BADGE_CLASS, TASK_ROLE_LABEL } from '../../lib/roles';
import { columnColor } from '../../lib/palette';

interface TaskDetailHeaderProps {
  task: Task;
  /**
   * (QL-141) Columna actual de la tarea, resuelta por el llamador contra `useColumns`. Se pinta
   * como chip con el **punto de color** de la columna (el mismo helper `columnColor` que usa el
   * board), no solo su nombre.
   */
  column?: Column;
  /**
   * (QL-141) Posición de la columna en el listado ordenado (para derivar un color estable si
   * `Column.color` es null, igual que el board). Se ignora cuando la columna sí trae `color`.
   */
  columnIndex?: number;
  /**
   * Elemento que renderiza el título (para usar `DialogTitle` en el modal o un `<h1>` en la
   * página). Por defecto un `<h2>`. Recibe las clases de tipografía del título.
   */
  titleAs?: 'h1' | 'h2';
  /** Acciones a la derecha del título (p. ej. el menú solo-ADMIN `TaskAdminMenu`). */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Cabecera compartida del detalle de una tarea (QL-25): título, badges (completada / mi rol)
 * y la línea de columna. La usan tanto la página dedicada (`TaskDetailPage`) como el modal de
 * vistazo rápido (`TaskDetailDialog`), evitando duplicar el markup del encabezado.
 */
export function TaskDetailHeader({
  task,
  column,
  columnIndex = 0,
  titleAs = 'h2',
  actions,
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
          {/* QL-142: si está descartada, banderín visible junto a los badges de estado. */}
          {task.isDiscarded && (
            <Badge className="bg-surface-container-high text-on-surface-variant">
              <Archive className="size-3.5" />
              Descartada
            </Badge>
          )}
          {task.isCompleted && (
            <Badge className="bg-tertiary-container text-on-tertiary-container">
              <CheckCircle2 className="size-3.5" />
              Completada
            </Badge>
          )}
          {/* QL-145: visto bueno visible para todos cuando la tarea ya fue validada. */}
          {task.validatedAt && task.validatedBy && (
            <Badge className="bg-tertiary-container text-on-tertiary-container">
              <BadgeCheck className="size-3.5" />
              Validado por: {task.validatedBy.name}
            </Badge>
          )}
          {task.currentUserRole && (
            <Badge className={cn(TASK_ROLE_BADGE_CLASS[task.currentUserRole])}>
              Tu rol: {TASK_ROLE_LABEL[task.currentUserRole]}
            </Badge>
          )}
          {actions}
        </div>
      </div>

      {(column || task.labels[0]) && (
        <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-on-surface-variant">
          {column && (
            <span className="inline-flex items-center gap-1.5">
              <span
                className={cn(
                  'size-2.5 shrink-0 rounded-full',
                  columnColor(column.color, columnIndex),
                )}
                aria-hidden
              />
              {column.name}
            </span>
          )}
          {task.labels[0] && <LabelChip label={task.labels[0]} size="md" />}
        </div>
      )}
    </div>
  );
}
