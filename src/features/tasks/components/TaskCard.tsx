import { CalendarClock, CheckCircle2, CheckSquare, Lock } from 'lucide-react';

import {
  AvatarGroup,
  AvatarGroupCount,
} from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { AuthedAvatar } from '@/shared/components/AuthedAvatar';

import type { Task } from '../services/tasks.service';
import { labelPillByText } from '../lib/palette';
import {
  formatDueDateShort,
  isDueToday,
  isOverdue,
} from '../lib/deadline';

interface TaskCardProps {
  task: Task;
  onClick: () => void;
}

const MAX_AVATARS = 3;

/**
 * Card compacta de una tarea (estilo Trello): pill de categoría opcional, título con estado
 * de completada, barra de progreso del checklist, y footer con avatares + fecha límite. El
 * rol por tarea ya no se muestra en la card (se ve en el detalle).
 */
export function TaskCard({ task, onClick }: TaskCardProps) {
  const visible = task.assignments.slice(0, MAX_AVATARS);
  const extra = task.assignments.length - visible.length;

  const dueToday = isDueToday(task.dueDate);
  const overdue = isOverdue(task.dueDate) && !task.isCompleted;
  const hasChecklist = task.checklistTotal > 0;
  const checklistPct = hasChecklist
    ? Math.round((task.checklistDone / task.checklistTotal) * 100)
    : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-3 text-left transition-colors hover:border-outline-variant hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      {task.label && (
        <span
          className={cn(
            'mb-2 inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase',
            labelPillByText(task.label),
          )}
        >
          {task.label}
        </span>
      )}

      <div className="flex items-start gap-1.5">
        {task.isCompleted && (
          <CheckCircle2
            className="mt-0.5 size-4 shrink-0 text-tertiary"
            aria-label="Completada"
          />
        )}
        <p
          className={cn(
            'line-clamp-2 text-sm font-medium',
            task.isCompleted
              ? 'text-on-surface-variant line-through'
              : 'text-on-surface',
          )}
        >
          {task.title}
        </p>
      </div>

      {hasChecklist && (
        <div className="mt-3 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-container-high">
            <div
              className="h-full rounded-full bg-tertiary transition-all"
              style={{ width: `${checklistPct}%` }}
            />
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-on-surface-variant">
            <CheckSquare className="size-3" />
            {task.checklistDone}/{task.checklistTotal}
          </span>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        {task.assignments.length > 0 ? (
          <AvatarGroup>
            {visible.map((a) => (
              <AuthedAvatar
                key={a.userId}
                size="sm"
                avatarDownloadUrl={a.user?.avatarDownloadUrl}
                avatarUrl={a.user?.avatarUrl}
                name={a.user?.name ?? a.userId}
              />
            ))}
            {extra > 0 && <AvatarGroupCount>+{extra}</AvatarGroupCount>}
          </AvatarGroup>
        ) : (
          <span className="text-xs text-on-surface-variant">Sin asignar</span>
        )}

        {task.dueDate && (
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
              overdue || dueToday
                ? 'bg-error-container text-on-error-container'
                : 'bg-surface-container-high text-on-surface-variant',
            )}
          >
            <CalendarClock className="size-3" />
            {dueToday ? 'Hoy' : formatDueDateShort(task.dueDate)}
            {task.deadlineLocked && (
              <Lock className="size-3" aria-label="Fecha bloqueada" />
            )}
          </span>
        )}
      </div>
    </button>
  );
}
