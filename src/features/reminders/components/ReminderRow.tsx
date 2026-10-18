import { Link } from 'react-router-dom';
import { ClipboardList, Lock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

import type { ReminderResponseDto } from '../types/reminder.types';
import { useReminderActions } from '../hooks/use-reminder-actions';
import { formatNextFire } from '../lib/bogota-time';
import { BLOCKED_TEXT } from '../lib/reminder-blocked';
import { KIND_LABELS, reminderGroup, scheduleSummary } from '../lib/reminder-display';
import { KIND_ICONS } from '../lib/reminder-icons';
import { ReminderActionsMenu } from './ReminderActionsMenu';
import { ReminderStatePill } from './ReminderStatePill';

interface ReminderRowProps {
  reminder: ReminderResponseDto;
  today: string;
  onEdit: () => void;
}

/** Tarea asociada: enlace aparte del mensaje (no se anidan); sin acceso, sin título (AC-23). */
export function ReminderTaskRefLink({ reminder }: { reminder: ReminderResponseDto }) {
  if (reminder.task) {
    return (
      <Link
        to={`/projects/${reminder.task.projectId}/tasks/${reminder.task.id}`}
        title="Abrir la tarea"
        className="inline-flex max-w-full min-w-0 items-center gap-1 font-medium text-primary hover:underline"
      >
        <ClipboardList className="size-3 shrink-0" aria-hidden />
        <span className="truncate">{reminder.task.title}</span>
      </Link>
    );
  }
  if (reminder.taskId) {
    return (
      <span className="inline-flex items-center gap-1 text-on-surface-variant">
        <Lock className="size-3 shrink-0" aria-hidden />
        Tarea sin acceso
      </span>
    );
  }
  return null;
}

/**
 * Fila de `/recordatorios` (maqueta): icono del tipo · mensaje (2 líneas, abre Editar) · resumen ·
 * tarea · «Próximo» · interruptor · ⋮. El interruptor es la pausa **manual** (`status`); con la
 * tarea cerrada sigue visible y la píldora explica el bloqueo (DS-10). Sin interruptor en Cumplidos.
 */
export function ReminderRow({ reminder, today, onEdit }: ReminderRowProps) {
  const group = reminderGroup(reminder);
  const actions = useReminderActions(reminder);
  const KindIcon = KIND_ICONS[reminder.schedule.kind];
  const blocked = reminder.blockedReason ? BLOCKED_TEXT[reminder.blockedReason] : null;

  const next =
    group === 'active' ? (
      <p className="text-[13px] whitespace-nowrap text-on-surface tabular-nums md:text-right">
        {reminder.nextFireAt ? (
          <>
            <span className="text-on-surface-variant">Próximo: </span>
            {formatNextFire(reminder.nextFireAt)}
          </>
        ) : (
          <span className="text-on-surface-variant">Sin próximo aviso</span>
        )}
      </p>
    ) : null;

  return (
    <li
      className={cn(
        'flex items-center gap-3 rounded-xl bg-surface-container-lowest py-3 pr-2 pl-4 dark:bg-surface-container-low',
        'max-md:items-start max-md:pr-1 max-md:pl-3',
        actions.deleting && 'opacity-50',
      )}
    >
      <span
        title={KIND_LABELS[reminder.schedule.kind]}
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center self-start rounded-lg bg-surface-container text-on-surface-variant dark:bg-surface-container-high"
      >
        <KindIcon className="size-4" />
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Button
          type="button"
          variant="link"
          onClick={onEdit}
          aria-label={`Editar: ${reminder.message}`}
          className={cn(
            'h-auto justify-start p-0 text-left text-sm font-medium whitespace-normal hover:no-underline max-md:text-[15px]',
            group === 'active' ? 'text-on-surface' : 'text-on-surface-variant',
          )}
        >
          <span className="line-clamp-2 break-words">{reminder.message}</span>
        </Button>

        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12.5px] text-on-surface-variant">
          <span>{scheduleSummary(reminder, today)}</span>
          {(reminder.task || reminder.taskId) && (
            <>
              <span aria-hidden className="opacity-60">
                ·
              </span>
              <ReminderTaskRefLink reminder={reminder} />
            </>
          )}
        </div>

        {next && <div className="mt-0.5 md:hidden">{next}</div>}

        {group !== 'active' && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <ReminderStatePill reminder={reminder} />
            {blocked && reminder.status === 'ACTIVE' && (
              <span className="text-xs text-on-surface-variant">{blocked.why}</span>
            )}
          </div>
        )}
      </div>

      {next && <div className="hidden md:block">{next}</div>}

      <div className="flex shrink-0 items-center">
        {group !== 'done' && (
          <span className="inline-flex size-9 items-center justify-center max-md:size-11">
            <Switch
              checked={actions.manualActive}
              onCheckedChange={(on) => actions.setPaused(!on)}
              disabled={actions.togglePending}
              aria-label={actions.manualActive ? 'Pausar recordatorio' : 'Reanudar recordatorio'}
            />
          </span>
        )}
        <ReminderActionsMenu
          message={reminder.message}
          onEdit={onEdit}
          pauseAction={group === 'done' ? null : actions.manualActive ? 'pause' : 'resume'}
          onTogglePause={() => actions.setPaused(actions.manualActive)}
          onDelete={actions.deleteReminder}
          disabled={actions.deleting}
        />
      </div>
    </li>
  );
}
