import {
  AlignLeft,
  CalendarClock,
  CheckCircle2,
  CheckSquare,
  Lock,
  TriangleAlert,
} from 'lucide-react';

import {
  AvatarGroup,
  AvatarGroupCount,
} from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { AuthedAvatar } from '@/shared/components/AuthedAvatar';

import { LabelChip } from '@/features/labels/components/LabelChip';

import type { Task } from '../services/tasks.service';
import {
  formatDueDate,
  formatDueDateShort,
  isDueToday,
  isOverdue,
} from '../lib/deadline';
import { formatRoles, participantsAssigneeFirst } from '../lib/roles';

interface TaskCardProps {
  task: Task;
  onClick: () => void;
}

const MAX_AVATARS = 3;

/**
 * Card compacta de una tarea (estilo Trello): pill de categoría opcional, título con estado
 * de completada, barra de progreso del checklist, y footer con avatares + señales + fecha
 * límite. Un click abre la **vista completa** de la tarea (QL-123: el Kanban ya no pasa por
 * el modal de vistazo rápido).
 *
 * (QL-123) Al desaparecer ese modal, la card absorbe sus señales **sin ganar altura**: el
 * Responsable se destaca dentro del grupo de avatares (primero + anillo `tertiary`, el mismo
 * token que su badge de rol), la descripción se anuncia con un icono, y el estado de plazo
 * distingue *vencida* (error + triángulo) de *vence hoy* (warning). Todo sale del objeto
 * `Task` que ya sirve el board (`GET /tasks?projectId=…`): **cero peticiones por tarjeta**.
 * El detalle largo (descripción completa, rol propio, checklist, comentarios, adjuntos,
 * cronómetro) vive en la vista de tarea, a un click de distancia.
 */
export function TaskCard({ task, onClick }: TaskCardProps) {
  // (QL-192) Una ficha por PERSONA: el Creador que además es Responsable trae dos entradas en
  // `assignments` y saldría dos veces (y contaría doble en el "+N") si se mapeara en crudo.
  const participants = participantsAssigneeFirst(task.assignments);
  const visible = participants.slice(0, MAX_AVATARS);
  const extra = participants.length - visible.length;

  const dueToday = isDueToday(task.dueDate);
  const overdue = isOverdue(task.dueDate) && !task.isCompleted;
  const hasChecklist = task.checklistTotal > 0;
  const checklistPct = hasChecklist
    ? Math.round((task.checklistDone / task.checklistTotal) * 100)
    : 0;
  const hasDescription = !!task.description?.trim();

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-3 text-left transition-colors hover:border-outline-variant hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      {task.labels[0] && (
        <div className="mb-2">
          <LabelChip label={task.labels[0]} />
        </div>
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
        {participants.length > 0 ? (
          <AvatarGroup>
            {visible.map((p) => {
              const name = p.user?.name ?? p.userId;
              const isAssignee = p.roles.includes('ASSIGNEE');
              return (
                <AuthedAvatar
                  key={p.userId}
                  size="sm"
                  // El anillo del grupo (`ring-background`) gana por especificidad al ser un
                  // selector de hijo directo: `!` lo sobrescribe para marcar al Responsable.
                  className={cn(isAssignee && 'ring-tertiary!')}
                  // (QL-192) Todos sus roles: "Ana · Creador · Responsable".
                  title={`${name} · ${formatRoles(p.roles)}`}
                  avatarDownloadUrl={p.user?.avatarDownloadUrl}
                  avatarUrl={p.user?.avatarUrl}
                  name={name}
                />
              );
            })}
            {extra > 0 && <AvatarGroupCount>+{extra}</AvatarGroupCount>}
          </AvatarGroup>
        ) : (
          <span className="text-xs text-on-surface-variant">Sin asignar</span>
        )}

        {/* Señales compactas (una sola línea, sin alto extra): descripción y plazo. */}
        <span className="flex shrink-0 items-center gap-1.5">
          {hasDescription && (
            <AlignLeft
              className="size-3.5 text-on-surface-variant"
              aria-label="Tiene descripción"
            />
          )}

          {task.dueDate && (
            <span
              title={
                overdue
                  ? `Vencida el ${formatDueDate(task.dueDate)}`
                  : dueToday
                    ? 'Vence hoy'
                    : `Vence el ${formatDueDate(task.dueDate)}`
              }
              className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                overdue
                  ? 'bg-error-container text-on-error-container'
                  : dueToday
                    ? 'bg-warning-container text-on-warning-container'
                    : 'bg-surface-container-high text-on-surface-variant',
              )}
            >
              {overdue ? (
                <TriangleAlert className="size-3" />
              ) : (
                <CalendarClock className="size-3" />
              )}
              {dueToday ? 'Hoy' : formatDueDateShort(task.dueDate)}
              {task.deadlineLocked && (
                <Lock className="size-3" aria-label="Fecha bloqueada" />
              )}
            </span>
          )}
        </span>
      </div>
    </button>
  );
}
