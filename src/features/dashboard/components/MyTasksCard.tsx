import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, CalendarClock, CheckCircle2, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatDueDateShort, isOverdue } from '@/features/tasks/lib/deadline';
import type { MyDashboard } from '../services/dashboard.service';

interface MyTasksCardProps {
  tasks: MyDashboard['tasks'];
}

/**
 * Bloque "Mis Tareas" (§3.14): contadores ATRASADAS (`overdue`) y HOY (`today`), y la
 * lista `upcoming` (título, proyecto, fecha, columna/estado). Cada tarea navega directo a
 * su vista dedicada `/projects/:id/tasks/:taskId` (QL-25). Estado vacío amable.
 */
export function MyTasksCard({ tasks }: MyTasksCardProps) {
  const navigate = useNavigate();
  const hasUpcoming = tasks.upcoming.length > 0;

  return (
    <section className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-on-surface">Mis tareas</h2>
        <Link
          to="/tasks"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Ver todas
          <ChevronRight className="size-4" />
        </Link>
      </div>

      {/* Contadores */}
      <div className="mb-5 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-error/20 bg-error-container/40 px-4 py-3">
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-on-error-container">
            <AlertTriangle className="size-3.5" />
            Atrasadas
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-on-surface">
            {tasks.overdue}
          </p>
        </div>
        <div className="rounded-lg border border-outline-variant/40 bg-surface-container px-4 py-3">
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-on-surface-variant">
            <CalendarClock className="size-3.5" />
            Hoy
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-on-surface">
            {tasks.today}
          </p>
        </div>
      </div>

      {/* Próximas */}
      {hasUpcoming ? (
        <ul className="space-y-1.5">
          {tasks.upcoming.map((task) => {
            const overdue = isOverdue(task.dueDate);
            return (
              <li key={task.id}>
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/projects/${task.projectId}/tasks/${task.id}`)
                  }
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-surface-container"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-on-surface">
                      {task.title}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-on-surface-variant">
                      {task.projectName ?? 'Proyecto'}
                      {task.columnName ? ` · ${task.columnName}` : ''}
                    </span>
                  </span>
                  {task.dueDate && (
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums',
                        overdue
                          ? 'bg-error-container text-on-error-container'
                          : 'bg-surface-container text-on-surface-variant',
                      )}
                    >
                      {formatDueDateShort(task.dueDate)}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-outline-variant/60 px-4 py-8 text-center">
          <CheckCircle2 className="size-6 text-primary" />
          <p className="text-sm font-medium text-on-surface">Todo en orden</p>
          <p className="text-xs text-on-surface-variant">
            No tienes tareas próximas. ¡Buen trabajo!
          </p>
        </div>
      )}
    </section>
  );
}
