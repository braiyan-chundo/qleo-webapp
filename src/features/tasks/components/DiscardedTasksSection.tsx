import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Archive, ArchiveRestore, ExternalLink, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/core/api/fetch-client';
import { LabelChip } from '@/features/labels/components/LabelChip';

import { useDiscardedTasks, useRestoreTask } from '../hooks/use-tasks';
import { useCanDiscardTask } from '../hooks/use-task-permissions';
import type { Task } from '../services/tasks.service';

interface DiscardedTasksSectionProps {
  projectId: string;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * (QL-142, §3.41) Sección **"Descartadas"** del proyecto: lista las tareas retiradas del tablero
 * (`GET /tasks?projectId=…&discarded=true`) en modo archivo. Cada tarjeta muestra quién y cuándo
 * la descartó y, para ADMIN, un botón **"Restaurar"** que la devuelve a su columna. Es la
 * contraparte no destructiva de Eliminar (QL-143).
 *
 * (QL-198b, §3.70 §9.1) La pestaña que la contiene se muestra a quien puede restaurar: ADMIN y
 * Dirección por rol, o quien tenga `TASK_DISCARD` **en este proyecto**. El componente re-verifica
 * el permiso para el botón (defensa en profundidad; el backend responde 403). Si el usuario ve
 * esta sección es porque es miembro del proyecto, así que con el permiso puede restaurar — es el
 * mismo criterio que el botón de descartar.
 */
export function DiscardedTasksSection({ projectId }: DiscardedTasksSectionProps) {
  const canRestore = useCanDiscardTask(projectId);
  const { data: tasks, isLoading, isError, error } = useDiscardedTasks(projectId);
  const restoreTask = useRestoreTask(projectId);
  /** Un 403 `TASK_DISCARD_FORBIDDEN` retira la acción en vez de invitar a reintentarla. */
  const [restoreDenied, setRestoreDenied] = useState(false);

  const showRestore = canRestore && !restoreDenied;

  const handleRestore = (task: Task) => {
    restoreTask.mutate(task.id, {
      onSuccess: () => toast.success(`Tarea "${task.title}" restaurada`),
      onError: (err) => {
        if (err instanceof ApiError && err.code === 'TASK_DISCARD_FORBIDDEN') {
          setRestoreDenied(true);
          toast.error(err.message);
          return;
        }
        toast.error(err instanceof Error ? err.message : 'No se pudo restaurar la tarea');
      },
    });
  };

  if (isLoading) {
    return (
      <div className="mt-4 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mt-4 rounded-xl border border-error/20 bg-error-container px-6 py-10 text-center">
        <p className="text-sm font-medium text-on-error-container">
          No se pudieron cargar las tareas descartadas
        </p>
        <p className="mt-1 text-xs text-on-error-container/80">
          {error instanceof Error ? error.message : 'Error desconocido'}
        </p>
      </div>
    );
  }

  if (!tasks || tasks.length === 0) {
    return (
      <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant/60 bg-surface-container-low px-6 py-16 text-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-primary-container text-primary">
          <Archive className="size-7" />
        </div>
        <h2 className="text-lg font-semibold text-on-surface">Sin tareas descartadas</h2>
        <p className="mt-1 max-w-sm text-sm text-on-surface-variant">
          Las tareas que se descarten aparecerán aquí, fuera del tablero, y podrán
          restaurarse a su columna.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm text-on-surface-variant">
        {tasks.length === 1
          ? '1 tarea descartada.'
          : `${tasks.length} tareas descartadas.`}{' '}
        Fuera del tablero y de "Mis tareas"; se pueden restaurar sin perder nada.
      </p>

      <ul className="space-y-3">
        {tasks.map((task) => (
          <li
            key={task.id}
            className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-outline-variant/50 bg-surface-container-low px-4 py-3"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to={`/projects/${projectId}/tasks/${task.id}`}
                  className="truncate font-medium text-on-surface hover:underline"
                >
                  {task.title}
                </Link>
                {task.labels[0] && <LabelChip label={task.labels[0]} />}
              </div>
              <p className="text-xs text-on-surface-variant">
                Descartada
                {task.discardedBy ? ` por ${task.discardedBy.name}` : ''}
                {task.discardedAt ? ` · ${formatDateTime(task.discardedAt)}` : ''}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button
                asChild
                variant="ghost"
                size="sm"
                aria-label={`Abrir ${task.title}`}
              >
                <Link to={`/projects/${projectId}/tasks/${task.id}`}>
                  <ExternalLink />
                  <span className="hidden sm:inline">Abrir</span>
                </Link>
              </Button>
              {showRestore && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleRestore(task)}
                  disabled={
                    restoreTask.isPending && restoreTask.variables === task.id
                  }
                >
                  {restoreTask.isPending && restoreTask.variables === task.id ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <ArchiveRestore />
                  )}
                  Restaurar
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
