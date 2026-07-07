import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Play, Square, Timer } from 'lucide-react';

import { ApiError } from '@/core/api/fetch-client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AuthedAvatar } from '@/shared/components/AuthedAvatar';

import { useStartTimer, useStopTimer, useTaskTime } from '../hooks/use-tasks';
import type { Task } from '../services/tasks.service';
import { formatClock, formatDuration, secondsSince } from '../lib/time';

interface TimeTrackerSectionProps {
  task: Task;
}

/**
 * Sección "Tiempo trabajado" del detalle de tarea (QL-17, RF-2.4). Muestra el total
 * acumulado, un contador **en vivo** cuando el usuario tiene el cronómetro en marcha
 * (`running`), el desglose por usuario y el botón Iniciar/Detener.
 *
 * Gating: solo CREATOR/ASSIGNEE/COLLABORATOR pueden iniciar/detener; OBSERVER y no
 * participantes ven el tiempo en solo lectura (el backend además valida con
 * `READ_ONLY_ROLE`).
 */
export function TimeTrackerSection({ task }: TimeTrackerSectionProps) {
  const { data: time, isLoading } = useTaskTime(task.id);
  const startTimer = useStartTimer(task.id);
  const stopTimer = useStopTimer(task.id);

  const role = task.currentUserRole;
  const canTrack =
    role === 'CREATOR' || role === 'ASSIGNEE' || role === 'COLLABORATOR';

  const running = time?.running ?? false;
  const runningSince = time?.runningSince ?? null;
  const pending = startTimer.isPending || stopTimer.isPending;

  // Contador en vivo: segundos del tramo en marcha del usuario (desde `runningSince`).
  // `setInterval` de 1 s mientras `running`; se limpia al desmontar o al detener.
  const [liveSeconds, setLiveSeconds] = useState(0);

  useEffect(() => {
    if (!running || !runningSince) {
      setLiveSeconds(0);
      return;
    }
    setLiveSeconds(secondsSince(runningSince));
    const interval = window.setInterval(() => {
      setLiveSeconds(secondsSince(runningSince));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [running, runningSince]);

  // Total mostrado = tramos cerrados + tramo vivo del usuario (aún no sumado por el server).
  const totalSeconds = time?.totalSeconds ?? 0;
  const displayedTotal = running ? totalSeconds + liveSeconds : totalSeconds;

  const breakdown = useMemo(
    () => [...(time?.breakdown ?? [])].sort((a, b) => b.seconds - a.seconds),
    [time?.breakdown],
  );

  const handleStart = () => {
    startTimer.mutate(undefined, {
      onSuccess: () => toast.success('Cronómetro iniciado'),
      onError: handleTimerError,
    });
  };

  const handleStop = () => {
    stopTimer.mutate(undefined, {
      onSuccess: () => toast.success('Cronómetro detenido'),
      onError: handleTimerError,
    });
  };

  return (
    <section className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-on-surface-variant">
          <Timer className="size-3.5" />
          Tiempo trabajado
        </p>

        {canTrack &&
          (running ? (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={handleStop}
              disabled={pending}
            >
              {stopTimer.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Square className="fill-current" />
              )}
              Detener
            </Button>
          ) : (
            <Button type="button" size="sm" onClick={handleStart} disabled={pending}>
              {startTimer.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Play className="fill-current" />
              )}
              Iniciar
            </Button>
          ))}
      </div>

      {isLoading ? (
        <Skeleton className="mt-3 h-8 w-40 rounded-md" />
      ) : (
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-semibold tabular-nums text-on-surface">
            {formatDuration(displayedTotal)}
          </span>
          {running && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-tertiary-container px-2 py-0.5 text-xs font-medium text-on-tertiary-container">
              <span className="size-1.5 animate-pulse rounded-full bg-current" />
              En marcha · {formatClock(liveSeconds)}
            </span>
          )}
        </div>
      )}

      {breakdown.length > 1 && (
        <ul className="mt-3 space-y-1.5 border-t border-outline-variant/40 pt-3">
          {breakdown.map((entry) => (
            <li
              key={entry.user.id}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="inline-flex min-w-0 items-center gap-2">
                <AuthedAvatar
                  size="sm"
                  avatarDownloadUrl={entry.user.avatarDownloadUrl}
                  avatarUrl={entry.user.avatarUrl}
                  name={entry.user.name}
                />
                <span className="truncate text-on-surface">{entry.user.name}</span>
              </span>
              <span className="shrink-0 tabular-nums text-on-surface-variant">
                {formatDuration(entry.seconds)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {!canTrack && (
        <p className="mt-2 text-xs text-on-surface-variant">
          Tu rol es de solo lectura: puedes ver el tiempo, pero no cronometrar.
        </p>
      )}
    </section>
  );
}

/** Traduce los `error.code` del cronómetro (QL-17) a toasts claros en español. */
function handleTimerError(err: unknown) {
  if (err instanceof ApiError) {
    if (err.code === 'TIMER_ALREADY_RUNNING') {
      toast.error('Ya tienes un cronómetro en marcha en esta tarea.');
      return;
    }
    if (err.code === 'NO_RUNNING_TIMER') {
      toast.error('No tienes ningún cronómetro en marcha.');
      return;
    }
    if (err.code === 'READ_ONLY_ROLE') {
      toast.error('Como Observador no puedes usar el cronómetro.');
      return;
    }
  }
  toast.error(err instanceof Error ? err.message : 'No se pudo actualizar el cronómetro');
}
