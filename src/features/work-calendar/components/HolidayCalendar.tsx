import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { Holiday } from '../services/work-calendar.service';

/** Cabecera de días, semana empezando en lunes (coherente con Planner/Gantt). */
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const;

/** `yyyy-mm-dd` (componentes locales) — misma clave que usa el backend de festivos. */
function ymd(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

interface DayCell {
  key: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  holiday?: Holiday;
}

/** Construye la grilla del mes (semanas lun–dom) con festivos/fines de semana marcados. */
function buildGrid(
  year: number,
  month: number,
  holidayByKey: Map<string, Holiday>,
): DayCell[][] {
  const first = new Date(year, month, 1);
  const mondayOffset = (first.getDay() + 6) % 7; // getDay: 0=Dom..6=Sáb → Lun=0
  const now = new Date();
  const todayKey = ymd(now.getFullYear(), now.getMonth(), now.getDate());

  let cursor = new Date(year, month, 1 - mondayOffset);
  const weeks: DayCell[][] = [];

  for (let w = 0; w < 6; w += 1) {
    const week: DayCell[] = [];
    for (let d = 0; d < 7; d += 1) {
      const y = cursor.getFullYear();
      const mo = cursor.getMonth();
      const da = cursor.getDate();
      const key = ymd(y, mo, da);
      const dow = cursor.getDay();
      week.push({
        key,
        day: da,
        inMonth: mo === month,
        isToday: key === todayKey,
        isWeekend: dow === 0 || dow === 6,
        holiday: holidayByKey.get(key),
      });
      cursor = new Date(y, mo, da + 1);
    }
    weeks.push(week);
  }

  // Recorta la 6ª semana si es completamente de otro mes.
  if (weeks[5].every((c) => !c.inMonth)) weeks.pop();
  return weeks;
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('es', {
    month: 'long',
    year: 'numeric',
  });
}

interface HolidayCalendarProps {
  holidays: Holiday[];
  /** Al hacer clic en un día, se propaga su `yyyy-mm-dd` (p. ej. para prellenar el formulario). */
  onSelectDate?: (isoDay: string) => void;
  /** Día actualmente seleccionado en el formulario (`yyyy-mm-dd`), para resaltarlo. */
  selectedDate?: string;
}

/**
 * Calendario mensual del calendario laboral (QL-10): visualiza qué días son **no laborables**
 * —fines de semana (atenuados) y **festivos** (resaltados, con su nombre)— para que la pantalla
 * se entienda de un vistazo. Navegación por mes; al hacer clic en un día se propaga su fecha
 * (para prellenar el formulario de "añadir festivo").
 */
export function HolidayCalendar({
  holidays,
  onSelectDate,
  selectedDate,
}: HolidayCalendarProps) {
  const today = useMemo(() => new Date(), []);
  const [{ year, month }, setMonth] = useState({
    year: today.getFullYear(),
    month: today.getMonth(),
  });

  const holidayByKey = useMemo(() => {
    const map = new Map<string, Holiday>();
    for (const h of holidays) map.set(h.date, h);
    return map;
  }, [holidays]);

  const grid = useMemo(
    () => buildGrid(year, month, holidayByKey),
    [year, month, holidayByKey],
  );

  const shift = (delta: number) =>
    setMonth((prev) => {
      const d = new Date(prev.year, prev.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  const goToday = () =>
    setMonth({ year: today.getFullYear(), month: today.getMonth() });

  return (
    <div>
      {/* Navegación de mes */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-on-surface capitalize">
          {monthLabel(year, month)}
        </h2>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={goToday}>
            Hoy
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Mes anterior"
            onClick={() => shift(-1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Mes siguiente"
            onClick={() => shift(1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-outline-variant/40 bg-surface">
        {/* Cabecera de días de la semana */}
        <div className="grid grid-cols-7 border-b border-outline-variant/40 bg-surface-container-low">
          {WEEKDAYS.map((label) => (
            <div
              key={label}
              className="px-2 py-2 text-center text-xs font-medium text-on-surface-variant"
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
                selected={cell.key === selectedDate}
                onSelect={onSelectDate}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Leyenda */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-on-surface-variant">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded bg-error/25 ring-1 ring-error/40" aria-hidden />
          Festivo
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="size-3 rounded bg-surface-container-high ring-1 ring-outline-variant/50"
            aria-hidden
          />
          Fin de semana (no laborable)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-primary" aria-hidden />
          Hoy
        </span>
      </div>
    </div>
  );
}

interface DayCellViewProps {
  cell: DayCell;
  selected: boolean;
  onSelect?: (isoDay: string) => void;
}

/** Celda de día: atenúa fines de semana, resalta festivos (con nombre) y marca hoy. */
function DayCellView({ cell, selected, onSelect }: DayCellViewProps) {
  const { day, inMonth, isToday, isWeekend, holiday } = cell;

  return (
    <button
      type="button"
      onClick={() => onSelect?.(cell.key)}
      title={holiday ? holiday.name : undefined}
      className={cn(
        'flex min-h-20 flex-col border-r border-outline-variant/20 p-1.5 text-left transition-colors last:border-r-0',
        'hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary',
        !inMonth && 'bg-surface-container-lowest/40',
        isWeekend && inMonth && !holiday && 'bg-surface-container-high/40',
        holiday && 'bg-error/10',
        selected && 'ring-2 ring-inset ring-primary',
      )}
    >
      <span className="mb-1 flex justify-end">
        <span
          className={cn(
            'inline-flex size-6 items-center justify-center rounded-full text-xs',
            isToday
              ? 'bg-primary font-semibold text-on-primary'
              : inMonth
                ? 'text-on-surface'
                : 'text-on-surface-variant/50',
          )}
        >
          {day}
        </span>
      </span>

      {holiday && inMonth && (
        <span className="mt-auto line-clamp-2 rounded bg-error/15 px-1 py-0.5 text-[11px] font-medium leading-tight text-error">
          {holiday.name}
        </span>
      )}
    </button>
  );
}
