import { Activity } from 'lucide-react';

import { useTaskAnalytics } from '@/features/analytics/hooks/use-analytics';
import { TimePerColumnChart } from '@/features/analytics/components/TimePerColumnChart';
import {
  ChartCard,
  ChartState,
  StatTile,
} from '@/features/analytics/components/analytics-primitives';
import { formatDuration } from '@/features/analytics/lib/format';
import type { StageTimeStats } from '@/features/analytics/services/analytics.service';

import { formatDateTime } from '../lib/time';

interface TaskAnalyticsSectionProps {
  taskId: string;
}

/**
 * Análisis detallado de UNA tarea (P5/§3.24, `GET /analytics/tasks/:id`). **Solo ADMIN** de
 * plataforma: el llamador (`TaskDetailPage`) ya gatea por rol, el hook además exige ADMIN y el
 * backend responde 403 si no. Muestra el **estado actual** (tiempo hábil vs reloj de pared,
 * columna/etapa, en curso), el **tiempo por columna** y el **tiempo por etapa** — ambos en
 * **reloj de pared** (tiempo de estancia), como aclara el copy.
 */
export function TaskAnalyticsSection({ taskId }: TaskAnalyticsSectionProps) {
  const { data, isLoading, isError } = useTaskAnalytics(taskId);
  const current = data?.current;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-on-surface">
          <Activity className="size-5 text-on-surface-variant" />
          Análisis de la tarea
        </h2>
        <span className="rounded-full bg-secondary-container px-2 py-0.5 text-xs font-medium text-on-secondary-container">
          Solo administradores
        </span>
      </div>

      {/* Estado actual: tiempo hábil vs reloj de pared + ubicación actual. */}
      <ChartCard
        title="Estado actual"
        description="Tiempo hábil (horario laboral) frente al reloj de pared, y ubicación actual de la tarea."
      >
        <ChartState
          isLoading={isLoading}
          isError={isError}
          isEmpty={!current}
          errorMessage="No se pudo cargar el análisis de la tarea."
        >
          {current && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <StatTile
                  label="Tiempo hábil"
                  value={formatDuration(current.workedMs)}
                />
                <StatTile
                  label="Reloj de pared"
                  value={formatDuration(current.wallMs)}
                />
              </div>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <MetaRow label="Columna actual" value={current.columnName} />
                <MetaRow label="Etapa actual" value={current.stageName} />
                <MetaRow label="Inició" value={formatDateTime(current.startedAt)} />
                <MetaRow
                  label="Finalizó"
                  value={
                    current.finishedAt
                      ? formatDateTime(current.finishedAt)
                      : current.running
                        ? 'En curso'
                        : undefined
                  }
                />
              </dl>
            </div>
          )}
        </ChartState>
      </ChartCard>

      {/* Tiempo por columna de ESTA tarea (reloj de pared). */}
      <TimePerColumnChart
        entries={data?.timePerColumn}
        isLoading={isLoading}
        isError={isError}
      />

      {/* Tiempo por etapa de ESTA tarea (reloj de pared). */}
      <StageTimeCard
        stages={data?.timePerStage}
        isLoading={isLoading}
        isError={isError}
      />
    </section>
  );
}

interface MetaRowProps {
  label: string;
  value?: string | null;
}

/** Par etiqueta/valor del estado actual (valor vacío → guion largo). */
function MetaRow({ label, value }: MetaRowProps) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-surface-container-low px-3 py-1.5">
      <dt className="text-on-surface-variant">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium text-on-surface">
        {value || '—'}
      </dd>
    </div>
  );
}

interface StageTimeCardProps {
  stages: StageTimeStats[] | undefined;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Tiempo por etapa (reloj de pared): lista con barra proporcional, total, nº de visitas y
 * media. Reutiliza `ChartCard`/`ChartState` y el formateador de ms de la analítica.
 */
function StageTimeCard({ stages, isLoading, isError }: StageTimeCardProps) {
  const rows = stages ?? [];
  const hasData = rows.some((s) => s.totalMs > 0);
  const max = Math.max(1, ...rows.map((s) => s.totalMs));

  return (
    <ChartCard
      title="Tiempo por etapa"
      description="Cuánto tiempo pasó la tarea en cada etapa del proyecto (reloj de pared)."
    >
      <ChartState
        isLoading={isLoading}
        isError={isError}
        isEmpty={rows.length === 0 || !hasData}
        emptyMessage="Aún no hay suficiente historial de etapas para medir tiempos."
      >
        <ul className="space-y-3">
          {rows.map((s) => (
            <li key={s.stageId}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate font-medium text-on-surface">
                  {s.name ?? 'Etapa eliminada'}
                </span>
                <span className="shrink-0 tabular-nums text-on-surface-variant">
                  {formatDuration(s.totalMs)}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-container-high">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.round((s.totalMs / max) * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-on-surface-variant">
                {s.visits} {s.visits === 1 ? 'visita' : 'visitas'} · promedio{' '}
                {formatDuration(s.avgMs)}
              </p>
            </li>
          ))}
        </ul>
      </ChartState>
    </ChartCard>
  );
}
