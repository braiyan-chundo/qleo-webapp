import { CalendarClock, Timer } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';

import { useTaskTime } from '../hooks/use-tasks';
import type { Task } from '../services/tasks.service';
import { formatDateTime, formatDuration } from '../lib/time';

interface TimeTrackerSectionProps {
  task: Task;
}

/**
 * Sección "Tiempo trabajado" del detalle de tarea (P4/§3.13). El tiempo es **automático**: el
 * backend lo calcula como **tiempo hábil** (horario laboral, §3.23) entre la entrada a la
 * columna de inicio (`isStart`) y la de fin (`isEnd`) — QL-62 —, o "ahora" si sigue en curso.
 *
 * No hay cronómetro manual: se retiran los botones Iniciar/Detener, el contador vivo por
 * segundo (fuera de jornada el tiempo hábil no avanza, así que un tick de 1 s mentiría) y el
 * desglose por usuario (ya viene vacío). Todos los que ven la tarea ven el tiempo (sin gating).
 */
export function TimeTrackerSection({ task }: TimeTrackerSectionProps) {
  const { data: time, isLoading } = useTaskTime(task.id);

  const running = time?.running ?? false;
  const startedAt = time?.startedAt ?? null;
  const finishedAt = time?.finishedAt ?? null;
  // `totalSeconds` = round(workedMs/1000): mismo valor humanizado con el formateador del feature.
  const totalSeconds = time?.totalSeconds ?? 0;

  return (
    <section className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-on-surface-variant">
          <Timer className="size-3.5" />
          Tiempo trabajado
        </p>
        {running && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-tertiary-container px-2 py-0.5 text-xs font-medium text-on-tertiary-container">
            <span className="size-1.5 animate-pulse rounded-full bg-current" />
            En curso
          </span>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="mt-3 h-8 w-40 rounded-md" />
      ) : (
        <>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-on-surface">
            {formatDuration(totalSeconds)}
          </p>
          <p className="mt-1 flex items-start gap-1.5 text-xs text-on-surface-variant">
            <CalendarClock className="mt-0.5 size-3.5 shrink-0" />
            Se calcula automáticamente desde la columna de inicio hasta la de fin, contando
            solo el horario laboral.
          </p>

          {(startedAt || finishedAt) && (
            <dl className="mt-3 space-y-1 border-t border-outline-variant/40 pt-2 text-xs">
              {startedAt && (
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-on-surface-variant">Inició</dt>
                  <dd className="tabular-nums text-on-surface">
                    {formatDateTime(startedAt)}
                  </dd>
                </div>
              )}
              {finishedAt && (
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-on-surface-variant">Finalizó</dt>
                  <dd className="tabular-nums text-on-surface">
                    {formatDateTime(finishedAt)}
                  </dd>
                </div>
              )}
            </dl>
          )}

          {!startedAt && (
            <p className="mt-2 text-xs text-on-surface-variant">
              Aún no ha comenzado: el tiempo se contará cuando la tarea entre en la columna de
              inicio.
            </p>
          )}
        </>
      )}
    </section>
  );
}
