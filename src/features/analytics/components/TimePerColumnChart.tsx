import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { ChartCard, ChartState, CHART_COLORS } from './analytics-primitives';
import { formatDuration } from '../lib/format';
import type { TimePerColumnEntry } from '../services/analytics.service';

/**
 * 2.4 — Tiempo promedio por columna (reconstruido desde `TaskTransition`). Barras
 * horizontales, una serie (color `primary`), con etiqueta directa de la duración humanizada;
 * el tooltip añade total y nº de estancias. Una sola serie → sin leyenda (el título la nombra).
 * Las columnas de inicio/fin se anotan en la etiqueta del eje.
 */

interface Row {
  label: string;
  avgMs: number;
  totalMs: number;
  visits: number;
}

interface TooltipPayloadItem {
  payload: Row;
}

function DurationTooltip({
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
      <p className="mb-1 font-semibold text-on-surface">{row.label}</p>
      <p className="text-on-surface-variant">
        Promedio: <span className="font-medium text-on-surface">{formatDuration(row.avgMs)}</span>
      </p>
      <p className="text-on-surface-variant">
        Total: <span className="font-medium text-on-surface">{formatDuration(row.totalMs)}</span>
      </p>
      <p className="text-on-surface-variant">
        Estancias: <span className="font-medium text-on-surface tabular-nums">{row.visits}</span>
      </p>
    </div>
  );
}

export function TimePerColumnChart({
  entries,
  isLoading,
  isError,
}: {
  entries: TimePerColumnEntry[] | undefined;
  isLoading: boolean;
  isError: boolean;
}) {
  const rows: Row[] = (entries ?? []).map((e) => {
    const base = e.name ?? 'Columna eliminada';
    const suffix = e.isStart ? ' (inicio)' : e.isEnd ? ' (fin)' : '';
    return {
      label: `${base}${suffix}`,
      avgMs: e.avgMs,
      totalMs: e.totalMs,
      visits: e.visits,
    };
  });

  const hasData = rows.some((r) => r.avgMs > 0);

  return (
    <ChartCard
      title="Tiempo promedio por etapa"
      description="Cuánto permanecen las tareas en cada columna del tablero."
    >
      <ChartState
        isLoading={isLoading}
        isError={isError}
        isEmpty={rows.length === 0 || !hasData}
        emptyMessage="Aún no hay suficientes movimientos de tareas para medir tiempos."
      >
        <ResponsiveContainer width="100%" height={Math.max(180, rows.length * 44)}>
          <BarChart
            layout="vertical"
            data={rows}
            margin={{ top: 4, right: 56, bottom: 4, left: 8 }}
            barCategoryGap="30%"
          >
            <CartesianGrid
              horizontal={false}
              stroke={CHART_COLORS.grid}
              strokeOpacity={0.4}
            />
            <XAxis
              type="number"
              tickFormatter={(v: number) => formatDuration(v)}
              tick={{ fontSize: 11, fill: CHART_COLORS.axis }}
              stroke={CHART_COLORS.axis}
              strokeOpacity={0.3}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={140}
              tick={{ fontSize: 12, fill: CHART_COLORS.axis }}
              stroke={CHART_COLORS.axis}
              strokeOpacity={0.3}
            />
            <Tooltip cursor={{ fill: 'var(--surface-container)', opacity: 0.4 }} content={<DurationTooltip />} />
            <Bar dataKey="avgMs" fill={CHART_COLORS.closed} radius={[0, 4, 4, 0]} maxBarSize={22}>
              {rows.map((r) => (
                <Cell key={r.label} />
              ))}
              <LabelList
                dataKey="avgMs"
                position="right"
                formatter={(value) => formatDuration(Number(value))}
                className="fill-on-surface-variant"
                style={{ fontSize: 11 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartState>
    </ChartCard>
  );
}
