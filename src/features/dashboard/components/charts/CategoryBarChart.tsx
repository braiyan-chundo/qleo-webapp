import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { ChartCard, ChartEmpty, ChartTooltipBox } from './chart-primitives';
import { CHART_COLORS } from './chart-utils';

/**
 * Gráfica de barras por categoría (QL-112), reutilizable por "Tareas por estado" y
 * "Proyectos por estado". La **identidad va por la etiqueta del eje X + el valor directo**
 * sobre cada barra (nunca solo por color, guía `dataviz`); el color solo refuerza. Cada
 * barra puede llevar su propio color semántico (estado) o uno común.
 */

export interface CategoryBarRow {
  /** Etiqueta corta del eje X (categoría). */
  label: string;
  value: number;
  /** Color de la barra (token M3 vía `var(--…)`). */
  color: string;
}

interface TooltipPayloadItem {
  payload: CategoryBarRow;
}

function CategoryTooltip({
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
      <p className="flex items-center gap-1.5 font-semibold text-on-surface">
        <span className="size-2.5 rounded-full" style={{ backgroundColor: row.color }} />
        {row.label}
      </p>
      <p className="mt-0.5 text-on-surface-variant">
        Total: <span className="font-medium tabular-nums text-on-surface">{row.value}</span>
      </p>
    </ChartTooltipBox>
  );
}

interface CategoryBarChartProps {
  title: string;
  description?: string;
  rows: CategoryBarRow[];
  emptyMessage: string;
  /** Nota al pie (p. ej. aclarar que "vencidas" es subconjunto de "abiertas"). */
  footnote?: string;
}

export function CategoryBarChart({
  title,
  description,
  rows,
  emptyMessage,
  footnote,
}: CategoryBarChartProps) {
  const hasData = rows.some((r) => r.value > 0);

  return (
    <ChartCard title={title} description={description}>
      {!hasData ? (
        <ChartEmpty message={emptyMessage} />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={rows} margin={{ top: 20, right: 8, bottom: 4, left: -16 }} barCategoryGap="28%">
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: CHART_COLORS.axis }}
                stroke={CHART_COLORS.axis}
                strokeOpacity={0.3}
                interval={0}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: CHART_COLORS.axis }}
                stroke={CHART_COLORS.axis}
                strokeOpacity={0.3}
                width={40}
              />
              <Tooltip cursor={{ fill: CHART_COLORS.cursor, opacity: 0.4 }} content={<CategoryTooltip />} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={64}>
                {rows.map((r) => (
                  <Cell key={r.label} fill={r.color} />
                ))}
                <LabelList
                  dataKey="value"
                  position="top"
                  className="fill-on-surface"
                  style={{ fontSize: 12, fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {footnote && <p className="mt-3 text-[11px] text-on-surface-variant">{footnote}</p>}
        </>
      )}
    </ChartCard>
  );
}
