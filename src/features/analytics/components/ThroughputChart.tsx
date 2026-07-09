import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { ChartCard, ChartState, CHART_COLORS } from './analytics-primitives';
import { formatWeekLabel } from '../lib/format';
import type { ThroughputPoint } from '../services/analytics.service';

/**
 * 2.6 — Throughput: tareas cerradas por semana (12 semanas). Área de una sola serie
 * (color `primary`); el backend garantiza 12 puntos (rellena con 0). Sin leyenda (una serie).
 */

interface Row {
  week: string;
  closed: number;
}

interface TooltipPayloadItem {
  payload: Row;
}

function ThroughputTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-3 py-2 text-xs shadow-md">
      <p className="mb-0.5 font-semibold text-on-surface">Semana del {row.week}</p>
      <p className="text-on-surface-variant">
        Cerradas: <span className="font-medium text-on-surface tabular-nums">{row.closed}</span>
      </p>
    </div>
  );
}

export function ThroughputChart({
  points,
  isLoading,
  isError,
}: {
  points: ThroughputPoint[] | undefined;
  isLoading: boolean;
  isError: boolean;
}) {
  const rows: Row[] = (points ?? []).map((p) => ({
    week: formatWeekLabel(p.weekStart),
    closed: p.closed,
  }));

  const hasData = rows.some((r) => r.closed > 0);

  return (
    <ChartCard
      title="Tareas cerradas por semana"
      description="Últimas 12 semanas."
    >
      <ChartState
        isLoading={isLoading}
        isError={isError}
        isEmpty={rows.length === 0}
        emptyMessage="Sin cierres registrados en el periodo."
      >
        {!hasData ? (
          <p className="py-8 text-center text-sm text-on-surface-variant">
            No se cerraron tareas en las últimas 12 semanas.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
              <defs>
                <linearGradient id="throughputFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS.closed} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={CHART_COLORS.closed} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} strokeOpacity={0.4} />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 11, fill: CHART_COLORS.axis }}
                stroke={CHART_COLORS.axis}
                strokeOpacity={0.3}
                interval="preserveStartEnd"
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: CHART_COLORS.axis }}
                stroke={CHART_COLORS.axis}
                strokeOpacity={0.3}
                width={40}
              />
              <Tooltip content={<ThroughputTooltip />} />
              <Area
                type="monotone"
                dataKey="closed"
                stroke={CHART_COLORS.closed}
                strokeWidth={2}
                fill="url(#throughputFill)"
                dot={{ r: 3, fill: CHART_COLORS.closed, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartState>
    </ChartCard>
  );
}
