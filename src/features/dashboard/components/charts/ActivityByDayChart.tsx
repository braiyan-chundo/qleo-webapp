import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { ActivityPoint } from '../../services/dashboard.service';
import { ChartCard, ChartEmpty, ChartTooltipBox } from './chart-primitives';
import { CHART_COLORS, formatShortDate } from './chart-utils';

/**
 * Actividad por día (QL-112): nº de entradas de auditoría por día, 14 días asc. Barras de
 * una sola serie (`primary`); el backend rellena los huecos con 0 → línea continua.
 */

interface Row {
  day: string;
  count: number;
}

interface TooltipPayloadItem {
  payload: Row;
}

function ActivityTooltip({
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
      <p className="mb-0.5 font-semibold text-on-surface">{row.day}</p>
      <p className="text-on-surface-variant">
        Acciones: <span className="font-medium tabular-nums text-on-surface">{row.count}</span>
      </p>
    </ChartTooltipBox>
  );
}

export function ActivityByDayChart({ points }: { points: ActivityPoint[] }) {
  const rows: Row[] = points.map((p) => ({
    day: formatShortDate(p.day),
    count: p.count,
  }));
  const hasData = rows.some((r) => r.count > 0);

  return (
    <ChartCard title="Actividad por día" description="Acciones registradas en los últimos 14 días.">
      {!hasData ? (
        <ChartEmpty message="Sin actividad registrada en los últimos 14 días." />
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: -16 }} barCategoryGap="20%">
            <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} strokeOpacity={0.4} />
            <XAxis
              dataKey="day"
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
            <Tooltip cursor={{ fill: CHART_COLORS.cursor, opacity: 0.4 }} content={<ActivityTooltip />} />
            <Bar dataKey="count" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} maxBarSize={26} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
