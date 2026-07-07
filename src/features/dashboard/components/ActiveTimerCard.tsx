import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Timer } from 'lucide-react';

import { formatClock, secondsSince } from '@/features/tasks/lib/time';
import type { ActiveTimer } from '../services/dashboard.service';

interface ActiveTimerCardProps {
  timer: ActiveTimer | null;
}

/**
 * Tarjeta compacta del ciclo activo / cronómetro (§3.14). Si hay un cronómetro en marcha
 * pinta un **contador en vivo** desde `startedAt` (reusa `secondsSince` + `formatClock` de
 * `features/tasks/lib/time`, el mismo patrón que `TimeTrackerSection`). Si es `null`,
 * muestra un estado neutro "sin ciclo activo".
 */
export function ActiveTimerCard({ timer }: ActiveTimerCardProps) {
  const startedAt = timer?.startedAt ?? null;
  const [liveSeconds, setLiveSeconds] = useState(0);

  // Contador en vivo: recalcula el transcurrido cada segundo mientras haya cronómetro.
  useEffect(() => {
    if (!startedAt) {
      setLiveSeconds(0);
      return;
    }
    setLiveSeconds(secondsSince(startedAt));
    const interval = window.setInterval(() => {
      setLiveSeconds(secondsSince(startedAt));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [startedAt]);

  if (!timer) {
    return (
      <section className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-5">
        <p className="inline-flex items-center gap-1.5 text-sm font-medium text-on-surface-variant">
          <Timer className="size-4" />
          Ciclo activo
        </p>
        <p className="mt-3 text-sm text-on-surface-variant">
          No tienes ningún cronómetro en marcha.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-tertiary/30 bg-tertiary-container/40 p-5">
      <p className="inline-flex items-center gap-1.5 text-sm font-medium text-on-tertiary-container">
        <span className="size-2 animate-pulse rounded-full bg-current" />
        Ciclo activo
      </p>
      <p className="mt-2 truncate text-base font-semibold text-on-surface">
        {timer.taskTitle ?? 'Tarea sin título'}
      </p>
      <p className="mt-3 font-mono text-3xl font-semibold tabular-nums text-on-surface">
        {formatClock(liveSeconds)}
      </p>
      {timer.projectId && (
        <Link
          to={`/projects/${timer.projectId}`}
          className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
        >
          Ir al proyecto
        </Link>
      )}
    </section>
  );
}
