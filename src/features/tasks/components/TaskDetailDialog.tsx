import { useNavigate } from 'react-router-dom';
import { CalendarClock, ExternalLink, Lock, User } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

import { useStages } from '@/features/stages/hooks/use-stages';
import { useColumns } from '@/features/columns/hooks/use-columns';

import { useTask } from '../hooks/use-tasks';
import { formatDueDate, isOverdue } from '../lib/deadline';
import { CompletionSection } from './CompletionSection';
import { TaskDetailHeader } from './detail/TaskDetailHeader';
import { TaskDescription } from './detail/TaskDescription';

interface TaskDetailDialogProps {
  taskId: string | null;
  projectId: string;
  onOpenChange: (open: boolean) => void;
}

/**
 * Vistazo rápido de una tarea (QL-25): modal ligero con título, badges (estado/rol),
 * descripción recortada, fecha límite y responsable, la acción de **Completar** y un botón
 * **"Abrir vista completa"** que navega a la página dedicada. Los paneles pesados
 * (checklist, adjuntos, roles, comentarios, cronómetro) viven ahora en `TaskDetailPage`.
 */
export function TaskDetailDialog({
  taskId,
  projectId,
  onOpenChange,
}: TaskDetailDialogProps) {
  const open = !!taskId;
  const navigate = useNavigate();
  const { data: task, isLoading, isError, error } = useTask(taskId ?? undefined);

  const { data: stages } = useStages(open ? projectId : undefined);
  const { data: columns } = useColumns(open ? projectId : undefined);

  const stageName = stages?.find((s) => s.id === task?.stageId)?.name;
  const columnName = columns?.find((c) => c.id === task?.columnId)?.name;

  const assignee = task?.assignments.find((a) => a.role === 'ASSIGNEE')?.user;
  const overdue = task ? isOverdue(task.dueDate) && !task.isCompleted : false;

  const openFullView = () => {
    if (!task) return;
    onOpenChange(false);
    navigate(`/projects/${projectId}/tasks/${task.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        )}

        {isError && (
          <div className="rounded-lg border border-error/20 bg-error-container px-4 py-6 text-center text-sm font-medium text-on-error-container">
            {error instanceof Error ? error.message : 'No se pudo cargar la tarea'}
          </div>
        )}

        {task && (
          <>
            <TaskDetailHeader
              task={task}
              stageName={stageName}
              columnName={columnName}
            />

            <TaskDescription description={task.description} clamp />

            {/* Fecha límite y responsable — datos clave del vistazo. */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-xs font-medium text-on-surface-variant">
                  <CalendarClock className="size-3.5" />
                  Fecha límite
                </p>
                {task.dueDate ? (
                  <p
                    className={cn(
                      'mt-1 flex items-center gap-1.5 text-sm font-medium',
                      overdue ? 'text-error' : 'text-on-surface',
                    )}
                  >
                    {formatDueDate(task.dueDate)}
                    {overdue && (
                      <span className="text-xs font-medium">(vencida)</span>
                    )}
                    {task.deadlineLocked && (
                      <Lock
                        className="size-3.5 text-on-surface-variant"
                        aria-label="Fecha bloqueada"
                      />
                    )}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-on-surface-variant">Sin fecha</p>
                )}
              </div>

              <div className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-xs font-medium text-on-surface-variant">
                  <User className="size-3.5" />
                  Responsable
                </p>
                <p className="mt-1 truncate text-sm font-medium text-on-surface">
                  {assignee?.name ?? 'Sin responsable'}
                </p>
              </div>
            </div>

            <CompletionSection task={task} projectId={projectId} />

            <DialogFooter className="gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cerrar
                </Button>
              </DialogClose>
              <Button type="button" onClick={openFullView}>
                <ExternalLink />
                Abrir vista completa
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
