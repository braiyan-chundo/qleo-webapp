import { lazy, Suspense, useState } from 'react';
import { AlarmClock, Info, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import type { ReminderResponseDto, ReminderTaskRef } from '../types/reminder.types';
import { useReminderActions } from '../hooks/use-reminder-actions';
import { useReminders } from '../hooks/use-reminders';
import { bogotaToday, formatNextFire } from '../lib/bogota-time';
import { reminderGroup, REMINDER_LIMIT, scheduleSummary } from '../lib/reminder-display';
import { ReminderActionsMenu } from './ReminderActionsMenu';
import { ReminderStatePill } from './ReminderStatePill';

interface RemindersTaskSectionProps {
  task: ReminderTaskRef;
}

// El formulario va en su propio chunk (con `vaul`, el selector y la vista previa): la vista de
// tarea está en el bundle principal, que ya roza el límite de precache del service worker.
const ReminderFormDialog = lazy(() =>
  import('./ReminderFormDialog').then((m) => ({ default: m.ReminderFormDialog })),
);

type FormTarget = { mode: 'create' } | { mode: 'edit'; id: string; snapshot: ReminderResponseDto };

/**
 * Sección «Recordatorios» de la vista de tarea (HU-0202, DS-7, AC-18): **solo los míos** de esta
 * tarea (`GET /reminders?taskId=`), y «Añadir» con la tarea fija. Cualquier rol en la tarea puede
 * (también el Observador, D-11): un recordatorio propio no toca la tarea.
 */
export function RemindersTaskSection({ task }: RemindersTaskSectionProps) {
  const { data, isLoading, isError, refetch } = useReminders(task.id);
  // El tope (100) cuenta todos los míos, no solo los de esta tarea. No se piden solo para esto:
  // se lee lo que ya haya en caché (si se visitó /recordatorios) sin disparar la petición; si no
  // hay, el aviso llega al guardar como 409 `REMINDER_LIMIT_REACHED`, que el formulario ya trata.
  const { data: all } = useReminders(undefined, { enabled: false });
  const [formOpen, setFormOpen] = useState(false);
  const [target, setTarget] = useState<FormTarget>({ mode: 'create' });

  const reminders = data ?? [];
  const atLimit = (all?.length ?? 0) >= REMINDER_LIMIT;
  const empty = !isLoading && !isError && reminders.length === 0;
  const today = bogotaToday();

  const editing =
    target.mode === 'edit' ? (reminders.find((r) => r.id === target.id) ?? null) : null;
  const dialogOpen = formOpen && (target.mode === 'create' || editing !== null);

  const openCreate = () => {
    setTarget({ mode: 'create' });
    setFormOpen(true);
  };

  // Nota bajo la lista si están en pausa por la tarea (lo dice `blockedReason`, no el cliente).
  const closedReason = reminders.find(
    (r) => r.blockedReason === 'TASK_COMPLETED' || r.blockedReason === 'TASK_DISCARDED',
  )?.blockedReason;

  return (
    <section
      aria-labelledby="task-reminders-title"
      className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-4 py-3"
    >
      <div className="flex items-center justify-between gap-2">
        <p
          id="task-reminders-title"
          className="inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap text-on-surface-variant"
        >
          <AlarmClock className="size-3.5" aria-hidden />
          Recordatorios
        </p>
        {!empty && !isLoading && !isError && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Añadir recordatorio"
            className="max-md:h-11"
            onClick={openCreate}
            disabled={atLimit}
          >
            <Plus />
            Añadir
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="mt-2 space-y-2" aria-busy="true">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ) : isError ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
          <span>No pudimos cargar tus recordatorios.</span>
          <Button
            type="button"
            variant="link"
            size="xs"
            className="h-auto p-0"
            onClick={() => void refetch()}
          >
            Reintentar
          </Button>
        </div>
      ) : empty ? (
        <>
          <p className="mt-1.5 text-[13px] text-on-surface-variant">
            Ponte un aviso para esta tarea. Solo lo verás tú.
          </p>
          <div className="mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="max-md:h-11 max-md:w-full"
              onClick={openCreate}
              disabled={atLimit}
            >
              <Plus />
              Añadir recordatorio
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-0.5 text-xs text-on-surface-variant">Solo los ves tú.</p>
          <ul className="mt-2 flex flex-col">
            {reminders.map((r) => (
              <TaskReminderRow
                key={r.id}
                reminder={r}
                today={today}
                onEdit={() => {
                  setTarget({ mode: 'edit', id: r.id, snapshot: r });
                  setFormOpen(true);
                }}
              />
            ))}
          </ul>
          {closedReason && (
            <p className="mt-1 flex items-start gap-1.5 text-xs text-on-surface-variant">
              <Info className="mt-0.5 size-3 shrink-0" aria-hidden />
              <span>
                {closedReason === 'TASK_COMPLETED'
                  ? 'No suenan mientras la tarea esté completada. Vuelven a sonar si se reabre.'
                  : 'No suenan mientras la tarea esté descartada. Vuelven a sonar si se restaura.'}
              </span>
            </p>
          )}
        </>
      )}

      {atLimit && (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-on-surface-variant">
          <Info className="mt-0.5 size-3 shrink-0" aria-hidden />
          <span>
            Llegaste al tope de 100 recordatorios. Elimina alguno en Recordatorios para añadir
            otro.
          </span>
        </p>
      )}

      <Suspense fallback={null}>
        <ReminderFormDialog
          open={dialogOpen}
          onOpenChange={setFormOpen}
          reminder={target.mode === 'edit' ? (editing ?? target.snapshot) : null}
          fixedTask={task}
        />
      </Suspense>
    </section>
  );
}

function TaskReminderRow({
  reminder,
  today,
  onEdit,
}: {
  reminder: ReminderResponseDto;
  today: string;
  onEdit: () => void;
}) {
  const group = reminderGroup(reminder);
  const actions = useReminderActions(reminder);
  const summary = scheduleSummary(reminder, today);
  const line =
    group === 'active' && reminder.nextFireAt
      ? `${summary} · Próximo: ${formatNextFire(reminder.nextFireAt)}`
      : summary;

  return (
    <li className="flex items-start gap-2 border-outline-variant/30 py-2 not-first:border-t max-md:min-h-12">
      <div className="min-w-0 flex-1">
        <Button
          type="button"
          variant="link"
          onClick={onEdit}
          aria-label={`Editar: ${reminder.message}`}
          className="h-auto w-full justify-start p-0 text-left text-sm font-medium whitespace-normal text-on-surface hover:no-underline"
        >
          <span className="break-words">{reminder.message}</span>
        </Button>
        <p className="text-xs text-on-surface-variant tabular-nums">{line}</p>
        {group !== 'active' && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <ReminderStatePill reminder={reminder} />
          </div>
        )}
      </div>
      <ReminderActionsMenu
        message={reminder.message}
        onEdit={onEdit}
        pauseAction={group === 'done' ? null : actions.manualActive ? 'pause' : 'resume'}
        onTogglePause={() => actions.setPaused(actions.manualActive)}
        onDelete={actions.deleteReminder}
        disabled={actions.deleting || actions.togglePending}
      />
    </li>
  );
}
