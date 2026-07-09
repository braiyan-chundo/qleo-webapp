import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { useHolidaysForYears } from '../hooks/use-work-calendar';
import type { Holiday } from '../services/work-calendar.service';
import {
  buildMonthGrid,
  countWorkingDaysInMonth,
  countWorkingDaysInYear,
  monthLabel,
  monthsInRange,
  yearsInRange,
  WEEKDAY_HEADERS,
  type CalendarDay,
} from '../lib/work-calendar';

interface WorkCalendarViewProps {
  /** Días de fin de semana (0=Dom … 6=Sáb) según la config. */
  weekendDays: number[];
}

/** Primer día del mes de una fecha. */
function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
/** Último día del mes de una fecha. */
function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/**
 * (QL-69) Vista visual del calendario laboral: distingue con **leyenda** los 4 tipos de día
 * (laborable / fin de semana / festivo automático / festivo manual), muestra el **conteo de
 * días laborables** del mes y del año, y admite un **rango de fechas** que, si abarca varios
 * meses, renderiza todos los meses. Solo lectura (el alta/gestión de festivos vive aparte).
 */
export function WorkCalendarView({ weekendDays }: WorkCalendarViewProps) {
  const today = useMemo(() => new Date(), []);
  const [from, setFrom] = useState<Date>(() => startOfMonth(today));
  const [to, setTo] = useState<Date>(() => endOfMonth(today));

  // Normaliza el rango (por si el usuario invierte from/to) a límites de mes.
  const rangeStart = from <= to ? from : to;
  const rangeEnd = from <= to ? to : from;

  const months = useMemo(
    () => monthsInRange(rangeStart, rangeEnd),
    [rangeStart, rangeEnd],
  );
  const years = useMemo(
    () => yearsInRange(rangeStart, rangeEnd),
    [rangeStart, rangeEnd],
  );

  const { holidays, isLoading } = useHolidaysForYears(years);

  const holidayByKey = useMemo(() => {
    const map = new Map<string, Holiday>();
    for (const h of holidays) map.set(h.date, h);
    return map;
  }, [holidays]);

  const holidayKeys = useMemo(() => new Set(holidayByKey.keys()), [holidayByKey]);

  const yearSummaries = useMemo(
    () =>
      years.map((year) => ({
        year,
        working: countWorkingDaysInYear(year, weekendDays, holidayKeys),
      })),
    [years, weekendDays, holidayKeys],
  );

  const setPresetMonth = () => {
    setFrom(startOfMonth(today));
    setTo(endOfMonth(today));
  };
  const setPresetYear = () => {
    setFrom(new Date(today.getFullYear(), 0, 1));
    setTo(new Date(today.getFullYear(), 11, 31));
  };

  return (
    <div className="space-y-4">
      {/* Controles de rango */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <span className="text-xs font-medium text-on-surface-variant">Desde</span>
          <DatePicker
            value={from}
            onChange={(d) => d && setFrom(d)}
            placeholder="Inicio"
            className="w-40"
          />
        </div>
        <div className="grid gap-1.5">
          <span className="text-xs font-medium text-on-surface-variant">Hasta</span>
          <DatePicker
            value={to}
            onChange={(d) => d && setTo(d)}
            placeholder="Fin"
            className="w-40"
          />
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={setPresetMonth}>
            Este mes
          </Button>
          <Button variant="outline" size="sm" onClick={setPresetYear}>
            Este año
          </Button>
        </div>
      </div>

      <Legend />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {months.map((ym) => (
            <MonthGrid
              key={`${ym.year}-${ym.month}`}
              year={ym.year}
              month={ym.month}
              weekendDays={weekendDays}
              holidayByKey={holidayByKey}
              workingDays={countWorkingDaysInMonth(
                ym.year,
                ym.month,
                weekendDays,
                holidayKeys,
              )}
            />
          ))}
        </div>
      )}

      {/* Resumen de días laborables por año visible */}
      {!isLoading && yearSummaries.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {yearSummaries.map((s) => (
            <span
              key={s.year}
              className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-1.5 text-sm"
            >
              <span className="font-medium text-on-surface">Año {s.year}:</span>
              <span className="tabular-nums text-on-surface-variant">
                {s.working} días laborables
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Leyenda de los 4 tipos de día, con colores M3 distintos entre sí. */
function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-on-surface-variant">
      <LegendSwatch className="bg-surface ring-1 ring-outline-variant/50" label="Laborable" />
      <LegendSwatch
        className="bg-surface-container-high ring-1 ring-outline-variant/60"
        label="Fin de semana"
      />
      <LegendSwatch
        className="bg-tertiary-container ring-1 ring-tertiary/40"
        label="Festivo automático"
      />
      <LegendSwatch
        className="bg-secondary-container ring-1 ring-secondary/40"
        label="Festivo manual"
      />
      <span className="inline-flex items-center gap-1.5">
        <span className="size-3 rounded-full bg-primary" aria-hidden />
        Hoy
      </span>
    </div>
  );
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('size-3 rounded', className)} aria-hidden />
      {label}
    </span>
  );
}

interface MonthGridProps {
  year: number;
  month: number;
  weekendDays: number[];
  holidayByKey: Map<string, Holiday>;
  workingDays: number;
}

/** Una grilla mensual (cabecera lun–dom + semanas) con su conteo de días laborables. */
function MonthGrid({
  year,
  month,
  weekendDays,
  holidayByKey,
  workingDays,
}: MonthGridProps) {
  const grid = useMemo(
    () => buildMonthGrid(year, month, weekendDays),
    [year, month, weekendDays],
  );

  return (
    <section className="overflow-hidden rounded-xl border border-outline-variant/40 bg-surface">
      <header className="flex items-center justify-between gap-2 border-b border-outline-variant/40 bg-surface-container-low px-3 py-2">
        <h3 className="text-sm font-semibold text-on-surface capitalize">
          {monthLabel(year, month)}
        </h3>
        <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-xs font-medium tabular-nums text-on-surface-variant">
          {workingDays} laborables
        </span>
      </header>

      {/* Cabecera de días de la semana */}
      <div className="grid grid-cols-7 border-b border-outline-variant/40">
        {WEEKDAY_HEADERS.map((label) => (
          <div
            key={label}
            className="px-1 py-1.5 text-center text-[11px] font-medium text-on-surface-variant"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Semanas */}
      {grid.map((week, wi) => (
        <div
          key={wi}
          className="grid grid-cols-7 border-b border-outline-variant/20 last:border-b-0"
        >
          {week.map((cell) => (
            <DayCellView
              key={cell.key}
              cell={cell}
              holiday={holidayByKey.get(cell.key)}
            />
          ))}
        </div>
      ))}
    </section>
  );
}

interface DayCellViewProps {
  cell: CalendarDay;
  holiday: Holiday | undefined;
}

/** Celda de día: color por tipo (festivo AUTO/MANUAL, fin de semana), nombre del festivo, hoy. */
function DayCellView({ cell, holiday }: DayCellViewProps) {
  const { day, inMonth, isToday, isWeekend } = cell;
  const isAuto = holiday?.source === 'AUTO';
  const isManual = holiday?.source === 'MANUAL';

  return (
    <div
      title={holiday ? holiday.name : undefined}
      className={cn(
        'flex min-h-16 flex-col border-r border-outline-variant/20 p-1 last:border-r-0',
        !inMonth && 'bg-surface-container-lowest/40',
        inMonth && isWeekend && !holiday && 'bg-surface-container-high/50',
        inMonth && isAuto && 'bg-tertiary-container/60',
        inMonth && isManual && 'bg-secondary-container/60',
      )}
    >
      <span className="mb-0.5 flex justify-end">
        <span
          className={cn(
            'inline-flex size-5 items-center justify-center rounded-full text-[11px] tabular-nums',
            isToday
              ? 'bg-primary font-semibold text-on-primary'
              : inMonth
                ? 'text-on-surface'
                : 'text-on-surface-variant/50',
          )}
          aria-label={inMonth && isWeekend ? 'Fin de semana' : undefined}
        >
          {day}
        </span>
      </span>

      {holiday && inMonth && (
        <span
          className={cn(
            'mt-auto line-clamp-2 rounded px-1 py-0.5 text-[10px] leading-tight font-medium',
            isAuto
              ? 'bg-tertiary-container text-on-tertiary-container'
              : 'bg-secondary-container text-on-secondary-container',
          )}
        >
          {holiday.name}
        </span>
      )}
    </div>
  );
}
