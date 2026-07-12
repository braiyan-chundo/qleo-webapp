import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { ThroughputPoint } from '../../services/dashboard.service';
import { ChartCard, ChartEmpty, ChartTooltipBox } from './chart-primitives';
import { CHART_COLORS, formatShortDate } from './chart-utils';

/**
 * Throughput global (QL-112): tareas cerradas por semana, 12 semanas asc. Área de una sola
 * serie (`primary`); sin leyenda (una serie → el título la nombra, guía `dataviz`).
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
    <ChartTooltipBox>
      <p className="mb-0.5 font-semibold text-on-surface">Semana del {row.week}</p>
      <p className="text-on-surface-variant">
        Cerradas: <span className="font-medium tabular-nums text-on-surface">{row.closed}</span>
      </p>
    </ChartTooltipBox>
  );
}

export function ThroughputAreaChart({ points }: { points: ThroughputPoint[] }) {
  const rows: Row[] = points.map((p) => ({
    week: formatShortDate(p.weekStart),
    closed: p.closed,
  }));
  const hasData = rows.some((r) => r.closed > 0);

  return (
    <ChartCard title="Tareas cerradas por semana" description="Throughput de las últimas 12 semanas.">
      {!hasData ? (
        <ChartEmpty message="No se cerraron tareas en las últimas 12 semanas." />
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
            <defs>
              <linearGradient id="dashThroughputFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.35} />
                <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0.02} />
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
              stroke={CHART_COLORS.primary}
              strokeWidth={2}
              fill="url(#dashThroughputFill)"
              dot={{ r: 3, fill: CHART_COLORS.primary, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
