import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, CalendarOff, Info, Minus } from 'lucide-react';

import { AuthedAvatar } from '@/shared/components/AuthedAvatar';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { cn } from '@/lib/utils';

import { ChartCard, ChartState } from './analytics-primitives';
import { formatDuration } from '../lib/format';
import {
  complianceDisplay,
  isComplianceMeasured,
  missingDatesHint,
  sortPerformance,
  TREND_PRESENTATION,
  type PerformanceSort,
} from '../lib/compliance';
import type { ComplianceTrend, UserPerformance } from '../services/analytics.service';

interface UserPerformanceCardProps {
  users: UserPerformance[] | undefined;
  isLoading: boolean;
  isError: boolean;
  /**
   * (QL-200) `complianceMinSample` de `GET /settings/management-alerts`. **Opcional**: solo sirve
   * para poder decir *"2 de 5 compromisos necesarios"*. Si no llega, se calla el denominador —
   * nunca se degrada a pintar el porcentaje, que eso lo decide `complianceReliable`.
   */
  complianceMinSample?: number;
}

/**
 * P6 (§3.24) + **QL-200 (§3.72)** — tabla de **rendimiento por usuario** (Dirección). Una fila por
 * persona; el backend la sirve ya ordenada por eficiencia desc.
 *
 * ## Las dos mitades de la tabla miden cosas distintas, y por eso van separadas
 *
 * `efficiency` (QL-65) y `complianceRate` (QL-200) se parecen —los dos van de 0 a 100— y no son lo
 * mismo: la eficiencia mezcla **puntualidad × volumen entregado**, mira solo tareas cerradas e
 * ignora la tarea vencida y aún abierta; el cumplimiento mide **solo puntualidad** sobre los
 * compromisos ya juzgables y cuenta la vencida-abierta como incumplimiento. Pintarlos como dos
 * columnas seguidas sin más sería la forma más rápida de que Dirección tome una decisión
 * equivocada sobre una persona, así que la tabla va partida en dos grupos con cabecera propia.
 *
 * ## Y la regla que manda sobre todas: no señalar a nadie por falta de datos
 *
 * Hoy solo **4 de 64 tareas** tienen fecha de fin y **los 9 usuarios activos** salen con
 * `complianceReliable: false` — dos de ellos con un `0 %` aritméticamente correcto sobre una
 * muestra de dos tareas. Ese 0 % es humanamente falso y esta pantalla la lee su jefe. Por eso:
 *
 * - sin muestra suficiente **no se pinta el porcentaje**, se dice "sin datos suficientes";
 * - `pendingWithoutDueDate` tiene **columna propia**: es lo que convierte un hueco inexplicable
 *   en una tarea de gestión concreta ("5 de sus 7 pendientes no tienen fecha");
 * - al ordenar por cumplimiento, las filas sin muestra **no encabezan la lista de peores**;
 * - `INSUFFICIENT_DATA` se pinta como tal, nunca como "estable".
 *
 * La decisión de *qué* se puede decir de cada fila vive en `lib/compliance`, no en este JSX: así
 * el componente solo elige una rama y no puede inventarse un número.
 */
export function UserPerformanceCard({
  users,
  isLoading,
  isError,
  complianceMinSample,
}: UserPerformanceCardProps) {
  const [sort, setSort] = useState<PerformanceSort>('efficiency');

  const source = useMemo(() => users ?? [], [users]);
  const rows = useMemo(() => sortPerformance(source, sort), [source, sort]);
  const withoutSample = useMemo(
    () => source.filter((r) => !isComplianceMeasured(r)).length,
    [source],
  );

  return (
    <ChartCard
      title="Rendimiento por usuario"
      description="Cumplimiento = puntualidad sobre compromisos con fecha. Eficiencia = puntualidad × volumen entregado. No son lo mismo."
      action={
        <NativeSelect
          className="shrink-0"
          value={sort}
          onChange={(e) => setSort(e.target.value as PerformanceSort)}
          aria-label="Ordenar la tabla"
        >
          <NativeSelectOption value="efficiency">Ordenar por eficiencia</NativeSelectOption>
          <NativeSelectOption value="compliance">
            Ordenar por cumplimiento (peor primero)
          </NativeSelectOption>
        </NativeSelect>
      }
    >
      <ChartState
        isLoading={isLoading}
        isError={isError}
        isEmpty={rows.length === 0}
        errorMessage="No se pudo cargar el rendimiento por usuario."
        emptyMessage="Aún no hay datos de rendimiento."
      >
        {/* (§3.72 §5) El aviso de arriba existe porque hoy el caso "sin datos" es la NORMA, no la
            excepción: sin explicarlo, una tabla llena de "sin datos suficientes" parece rota. */}
        {withoutSample > 0 && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-outline-variant/50 bg-surface-container-low px-3 py-2.5">
            <Info className="mt-0.5 size-4 shrink-0 text-on-surface-variant" aria-hidden />
            <div className="min-w-0 text-xs text-on-surface-variant">
              <p>
                El cumplimiento solo se puede calcular sobre tareas{' '}
                <strong className="font-medium text-on-surface">con fecha de fin</strong>. Hoy{' '}
                <strong className="font-medium text-on-surface">
                  {withoutSample} de {source.length}
                </strong>{' '}
                {withoutSample === 1 ? 'persona no llega' : 'personas no llegan'} a la muestra
                mínima
                {complianceMinSample != null && ` (${complianceMinSample} compromisos con fecha)`}{' '}
                y {withoutSample === 1 ? 'aparece' : 'aparecen'} como «sin datos suficientes».
              </p>
              <p className="mt-1">
                No es un mal resultado: es que todavía no hay con qué medir. Se corrige solo según
                se creen tareas nuevas, que ya nacen con fecha obligatoria.
              </p>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[78rem] border-collapse text-sm">
            <thead>
              {/* Cabecera de GRUPO: es lo que impide leer "cumplimiento" y "eficiencia" como si
                  fueran dos versiones del mismo número. */}
              <tr className="text-left text-xs text-on-surface-variant">
                <th
                  rowSpan={2}
                  className="sticky left-0 z-10 border-b border-outline-variant/50 bg-surface-container-lowest py-2 pr-3 align-bottom font-medium"
                >
                  Usuario
                </th>
                <th
                  colSpan={5}
                  className="border-b border-l border-outline-variant/50 px-2 pb-1 text-center font-semibold text-on-surface"
                  title="Solo puntualidad, sobre los compromisos con fecha ya juzgables (cerrados o vencidos). Excluye las tareas descartadas."
                >
                  Cumplimiento de plazos
                </th>
                <th
                  colSpan={9}
                  className="border-b border-l border-outline-variant/50 px-2 pb-1 text-center font-semibold text-on-surface"
                  title="Histórico de entrega. Incluye las tareas descartadas y no distingue «no cumple» de «no hay datos»."
                >
                  Productividad (histórico)
                </th>
              </tr>
              <tr className="border-b border-outline-variant/50 text-left text-xs text-on-surface-variant">
                <th className="border-l border-outline-variant/50 px-2 py-2 text-right font-medium">
                  Pendientes
                </th>
                <th className="px-2 py-2 text-right font-medium">Vencidas</th>
                <th
                  className="px-2 py-2 text-right font-medium"
                  title="Tareas pendientes sin fecha de fin: no hubo compromiso de fecha, así que no se pueden medir."
                >
                  Sin fecha de fin
                </th>
                <th
                  className="px-2 py-2 text-right font-medium"
                  title="% de compromisos con fecha entregados dentro de plazo. Una tarea vencida y aún abierta cuenta como incumplimiento."
                >
                  Cumplimiento
                </th>
                <th className="px-2 py-2 text-right font-medium">Tendencia</th>
                <th className="border-l border-outline-variant/50 px-2 py-2 text-right font-medium">
                  Proyectos
                </th>
                <th className="px-2 py-2 text-right font-medium">Asignadas</th>
                <th className="px-2 py-2 text-right font-medium">Totales</th>
                <th className="px-2 py-2 text-right font-medium">Finalizadas</th>
                <th className="px-2 py-2 text-right font-medium">A tiempo</th>
                <th className="px-2 py-2 text-right font-medium">Tarde</th>
                <th className="px-2 py-2 text-right font-medium">Duración prom.</th>
                <th className="px-2 py-2 text-right font-medium">Retraso prom.</th>
                <th
                  className="py-2 pl-2 text-right font-medium"
                  title="Puntualidad × volumen entregado. NO es el % de cumplimiento: sin datos vale 0, no «sin datos»."
                >
                  Eficiencia
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.user.id}
                  className="border-b border-outline-variant/25 last:border-0"
                >
                  <td className="sticky left-0 z-10 bg-surface-container-lowest py-2 pr-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <AuthedAvatar
                        size="sm"
                        avatarDownloadUrl={r.user.avatarDownloadUrl}
                        name={r.user.name}
                      />
                      <span className="truncate font-medium text-on-surface">
                        {r.user.name}
                      </span>
                    </span>
                  </td>

                  {/* ── Cumplimiento (QL-200) ── */}
                  <td className="border-l border-outline-variant/50 px-2 py-2 text-right tabular-nums text-on-surface">
                    {r.pendingTasks}
                  </td>
                  <td
                    className={cn(
                      'px-2 py-2 text-right tabular-nums',
                      r.overdueTasks > 0 ? 'text-error' : 'text-on-surface-variant',
                    )}
                  >
                    {r.overdueTasks}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <MissingDueDatesCell row={r} />
                  </td>
                  <td className="px-2 py-2">
                    <ComplianceCell row={r} minSample={complianceMinSample} />
                  </td>
                  <td className="px-2 py-2">
                    <TrendCell trend={r.complianceTrend} />
                  </td>

                  {/* ── Productividad (QL-65, sin cambios) ── */}
                  <td className="border-l border-outline-variant/50 px-2 py-2 text-right tabular-nums text-on-surface-variant">
                    {r.projects}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-on-surface-variant">
                    {r.assignedTasks}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-on-surface-variant">
                    {r.totalTasks}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-on-surface">
                    {r.completedTasks}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-on-surface">
                    {r.onTime}
                  </td>
                  <td
                    className={cn(
                      'px-2 py-2 text-right tabular-nums',
                      r.late > 0 ? 'text-error' : 'text-on-surface-variant',
                    )}
                  >
                    {r.late}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-on-surface-variant">
                    {formatDuration(r.avgDurationMs)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-on-surface-variant">
                    {formatDuration(r.avgDelayMs)}
                  </td>
                  <td className="py-2 pl-2">
                    <PercentMeter value={r.efficiency} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* (§3.72 §1) La asimetría heredada, dicha en voz alta: los dos bloques no cuentan lo
            mismo, así que estos números NO son el desglose de un total. */}
        <p className="mt-3 text-xs text-on-surface-variant">
          El bloque de cumplimiento excluye las tareas descartadas; el de productividad las
          incluye. Por eso «pendientes + finalizadas» no tiene por qué sumar «asignadas».
        </p>
      </ChartState>
    </ChartCard>
  );
}

/**
 * (QL-200) Las pendientes **sin fecha de fin**. No es un contador más: es la explicación de por
 * qué a esa persona no se la puede medir, así que cuando hay alguna se marca en vez de dejarla
 * como un número gris más de la fila.
 */
function MissingDueDatesCell({ row }: { row: UserPerformance }) {
  const hint = missingDatesHint(row);
  if (!hint) {
    return <span className="tabular-nums text-on-surface-variant">0</span>;
  }
  return (
    <span
      className="inline-flex items-center gap-1 text-on-surface-variant"
      title={`${hint} Ponerles fecha es lo que hace medible su cumplimiento.`}
    >
      <CalendarOff className="size-3 shrink-0" aria-hidden />
      <span className="tabular-nums">{row.pendingWithoutDueDate}</span>
    </span>
  );
}

/**
 * (QL-200, §3.72 §5) Celda del **% de cumplimiento**.
 *
 * Con muestra suficiente: el porcentaje con su barra y su denominador. Sin ella: *"sin datos
 * suficientes"* en tono **neutro** —nunca rojo, nunca un `0 %` grande— y, debajo, cuánta muestra
 * hay frente a la que haría falta. El porcentaje no concluyente solo viaja en el `title`, y
 * etiquetado como tal: existe, pero todavía no significa nada.
 */
function ComplianceCell({
  row,
  minSample,
}: {
  row: UserPerformance;
  minSample?: number;
}) {
  const display = complianceDisplay(row, minSample);
  const hint = missingDatesHint(row);

  if (display.kind === 'measured') {
    return (
      <div
        className="flex flex-col items-end gap-0.5"
        title={`${display.onTime} de ${display.sample} compromisos con fecha entregados dentro de plazo.`}
      >
        <PercentMeter value={display.rate} />
        <span className="text-[0.7rem] text-on-surface-variant tabular-nums">
          {display.onTime}/{display.sample} en plazo
        </span>
      </div>
    );
  }

  const sample = display.kind === 'insufficient' ? display.sample : 0;
  const needed = display.minSample;
  const inconclusive =
    display.kind === 'insufficient'
      ? `Dato no concluyente: ${display.inconclusiveRate} % sobre ${sample} ${
          sample === 1 ? 'compromiso' : 'compromisos'
        }, muestra insuficiente para sacar conclusiones. `
      : 'No tiene ningún compromiso con fecha que se pueda juzgar todavía. ';

  return (
    <div
      className="flex flex-col items-end gap-0.5"
      title={`${inconclusive}${hint ?? ''}`}
    >
      <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[0.7rem] font-medium text-on-surface-variant">
        Sin datos suficientes
      </span>
      <span className="text-[0.7rem] text-on-surface-variant tabular-nums">
        {needed != null
          ? `${sample} de ${needed} compromisos necesarios`
          : sample === 0
            ? 'ningún compromiso con fecha'
            : `${sample} ${sample === 1 ? 'compromiso' : 'compromisos'} con fecha`}
      </span>
    </div>
  );
}

/**
 * (QL-200, §3.72 §3) Flecha de tendencia. `INSUFFICIENT_DATA` se pinta como **ausencia de dato**
 * —un guion— y no como "estable": son cosas distintas, y confundirlas le diría a Dirección que
 * alguien está estancado cuando lo que pasa es que no tiene historial que comparar.
 */
function TrendCell({ trend }: { trend: ComplianceTrend }) {
  const presentation = TREND_PRESENTATION[trend.direction];
  const title = `Últimos ${trend.windowDays} días frente a los ${trend.windowDays} anteriores. ${presentation.hint}`;

  if (presentation.arrow === 'none') {
    return (
      <div className="flex justify-end">
        <span className="text-xs text-on-surface-variant" title={title} aria-label={title}>
          —
        </span>
      </div>
    );
  }

  const Icon =
    presentation.arrow === 'up' ? ArrowUp : presentation.arrow === 'down' ? ArrowDown : Minus;

  return (
    <div className="flex justify-end">
      <span
        className={cn('inline-flex items-center gap-1 text-xs font-medium', presentation.className)}
        title={title}
      >
        <Icon className="size-3.5 shrink-0" aria-hidden />
        {trend.deltaPoints != null ? (
          <span className="tabular-nums">
            {trend.deltaPoints > 0 ? '+' : ''}
            {trend.deltaPoints} pts
          </span>
        ) : (
          <span>{presentation.label}</span>
        )}
      </span>
    </div>
  );
}

/**
 * Barra + % con color por umbral (tokens M3). La usan las dos métricas de la tabla —eficiencia
 * (QL-65) y cumplimiento (QL-200)— porque la escala es la misma; lo que **no** comparten es
 * cuándo se pinta: el cumplimiento solo llega aquí con muestra fiable, así que su rojo es
 * información y no una acusación por falta de datos.
 */
function PercentMeter({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const tone = pct >= 75 ? 'bg-primary' : pct >= 40 ? 'bg-tertiary' : 'bg-error';

  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-container-high">
        <div className={cn('h-full rounded-full', tone)} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 text-right text-xs font-semibold tabular-nums text-on-surface">
        {pct}%
      </span>
    </div>
  );
}
