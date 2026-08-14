import { useMemo, useState } from 'react';
import { Cake, CalendarOff, ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import type { ResolvedShift, UserSchedule } from '@/features/schedules/services/schedules.service';
import { useUserSchedule } from '@/features/schedules/hooks/use-schedules';
import {
  formatShiftRange,
  parseYmdLocal,
  shiftsForDay,
} from '@/features/schedules/lib/schedule';
import {
  AbsenceDayChip,
  AbsenceLegendItem,
} from '@/features/absences/components/AbsenceDayChip';
import { useAbsenceCalendarForYears } from '@/features/absences/hooks/use-absences';
import { groupAbsencesByDay, type AbsenceOnDay } from '@/features/absences/lib/absence';

import {
  groupBirthdaysByDate,
  useBirthdaysForYears,
  useCalendarConfig,
  useHolidaysForYears,
} from '../hooks/use-work-calendar';
import type { Birthday, Holiday } from '../services/work-calendar.service';
import {
  buildMonthGrid,
  monthLabel,
  BIRTHDAY_CHIP,
  WEEKDAY_HEADERS,
  type CalendarDay,
} from '../lib/work-calendar';

/**
 * (QL-193) Referencia estable para los días sin cumpleaños: un `[]` literal en el JSX crearía un
 * array nuevo por celda y por render.
 */
const EMPTY_BIRTHDAYS: Birthday[] = [];

/** (QL-199) Mismo motivo para los días sin ausencias. */
const EMPTY_ABSENCES: AbsenceOnDay[] = [];

interface MemberCalendarViewProps {
  /** Id del usuario cuya malla se pinta (el propio MEMBER en QL-162; cualquiera en QL-163). */
  userId: string;
  /**
   * Si el calendario mostrado es el del **propio** usuario que mira (default `true`). El ADMIN
   * (QL-163) lo pasa a `false` al ver el de otra persona; solo cambia el copy de "sin malla".
   */
  ownCalendar?: boolean;
}

/**
 * (QL-162, §3.48) Calendario **de solo lectura**: un mes navegable con, por día, los turnos que
 * le tocan a `userId` según su **malla vigente** (`useUserSchedule`), los festivos (colombianos
 * + manuales) y el estilo de no-laborable para festivos y días sin turno. El **sábado intermedio**
 * se resuelve con `shiftsForDay` (misma regla que el backend). Sin acciones de edición. Lo usan el
 * MEMBER (su propio calendario) y el ADMIN (el de cualquier usuario, QL-163).
 */
export function MemberCalendarView({ userId, ownCalendar = true }: MemberCalendarViewProps) {
  const today = useMemo(() => new Date(), []);
  const [viewMonth, setViewMonth] = useState<{ year: number; month: number }>(() => ({
    year: today.getFullYear(),
    month: today.getMonth(),
  }));

  const { data: config } = useCalendarConfig();
  // Estabiliza la referencia: sin esto el `[0, 6]` de fallback es un array nuevo cada render y
  // reejecuta el `useMemo` de la grilla en balde.
  const weekendDays = useMemo(() => config?.weekendDays ?? [0, 6], [config?.weekendDays]);

  const { data: schedule, isLoading: scheduleLoading } = useUserSchedule(userId);
  // Cargada la malla y no hay ninguna vigente → el usuario no tiene malla asignada.
  const noSchedule = !scheduleLoading && !schedule;

  const grid = useMemo(
    () => buildMonthGrid(viewMonth.year, viewMonth.month, weekendDays),
    [viewMonth, weekendDays],
  );

  // Años tocados por la grilla (el relleno puede caer en el año vecino) → festivos de todos.
  const years = useMemo(() => {
    const set = new Set<number>();
    for (const week of grid) {
      for (const cell of week) set.add(Number(cell.key.slice(0, 4)));
    }
    return [...set];
  }, [grid]);

  const { holidays, isLoading: holidaysLoading } = useHolidaysForYears(years);

  const holidayByKey = useMemo(() => {
    const map = new Map<string, Holiday>();
    for (const h of holidays) map.set(h.date, h);
    return map;
  }, [holidays]);

  // (QL-193) Cumpleaños del/los año(s) visibles. No se espera a `holidaysLoading` para pintarlos:
  // van en su propia query y llegan cuando lleguen.
  const { birthdays } = useBirthdaysForYears(years);
  const birthdaysByKey = useMemo(() => groupBirthdaysByDate(birthdays), [birthdays]);

  // (QL-199, §3.71 §3) Ausencias del/los año(s) visibles. Como los cumpleaños: capa aparte, no
  // altera el conteo ni la naturaleza laboral del día. Las respuestas vienen SIN recortar, así que
  // la expansión se acota a los días que la grilla pinta de verdad.
  const { absences } = useAbsenceCalendarForYears(years);
  const gridFrom = grid[0][0].key;
  const gridTo = grid[grid.length - 1][6].key;
  const absencesByKey = useMemo(
    () => groupAbsencesByDay(absences, gridFrom, gridTo),
    // `absences` se recompone cada render (`useQueries`); la clave real es el rango + los datos.
    [absences, gridFrom, gridTo],
  );

  const goToday = () =>
    setViewMonth({ year: today.getFullYear(), month: today.getMonth() });
  const goPrev = () =>
    setViewMonth((m) =>
      m.month === 0 ? { year: m.year - 1, month: 11 } : { year: m.year, month: m.month - 1 },
    );
  const goNext = () =>
    setViewMonth((m) =>
      m.month === 11 ? { year: m.year + 1, month: 0 } : { year: m.year, month: m.month + 1 },
    );

  return (
    <div className="space-y-4">
      {/* Navegación de mes */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold capitalize text-on-surface">
          {monthLabel(viewMonth.year, viewMonth.month)}
        </h2>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={goToday}>
            Hoy
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={goPrev}
            aria-label="Mes anterior"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={goNext} aria-label="Mes siguiente">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {noSchedule && (
        <div className="flex items-start gap-2.5 rounded-xl border border-outline-variant/60 bg-surface-container-low p-4 text-sm text-on-surface">
          <CalendarOff className="mt-0.5 size-5 shrink-0 text-tertiary" />
          <div className="grid gap-0.5">
            <span className="font-medium">
              {ownCalendar
                ? 'No tienes mallas asignadas'
                : 'Este usuario no tiene mallas asignadas'}
            </span>
            <span className="text-on-surface-variant">
              Se muestran los festivos y días no laborables. La malla horaria la asigna
              Administración o Dirección.
            </span>
          </div>
        </div>
      )}

      <Legend />

      {holidaysLoading ? (
        <Skeleton className="h-[28rem] rounded-xl" />
      ) : (
        <section className="overflow-hidden rounded-xl border border-outline-variant/40 bg-surface">
          {/* Cabecera de días de la semana (lun–dom) */}
          <div className="grid grid-cols-7 border-b border-outline-variant/40">
            {WEEKDAY_HEADERS.map((label) => (
              <div
                key={label}
                className="px-1 py-2 text-center text-[11px] font-medium text-on-surface-variant"
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
                <DayCell
                  key={cell.key}
                  cell={cell}
                  holiday={holidayByKey.get(cell.key)}
                  schedule={schedule}
                  birthdays={birthdaysByKey.get(cell.key) ?? EMPTY_BIRTHDAYS}
                  absences={absencesByKey.get(cell.key) ?? EMPTY_ABSENCES}
                />
              ))}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

/** Leyenda de los tipos de día del calendario. */
function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-on-surface-variant">
      <LegendSwatch
        className="bg-primary-container ring-1 ring-primary/40"
        label="Con turno"
      />
      <LegendSwatch
        className="bg-secondary-container ring-1 ring-secondary/40"
        label="Festivo"
      />
      <LegendSwatch
        className="bg-surface-container-high ring-1 ring-outline-variant/60"
        label="No laborable"
      />
      <span className="inline-flex items-center gap-1.5">
        <span className="size-3 rounded-full bg-primary" aria-hidden />
        Hoy
      </span>
      {/* (QL-193) Con icono y no con muestra de color: es un EVENTO del día, no un tipo de día. */}
      <span className="inline-flex items-center gap-1.5">
        <Cake className="size-3 text-primary" aria-hidden />
        Cumpleaños
      </span>
      {/* (QL-199) Barra continua: es un RANGO, no un día. Ver `ABSENCE_CHIP`. */}
      <AbsenceLegendItem />
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

interface DayCellProps {
  cell: CalendarDay;
  holiday: Holiday | undefined;
  schedule: UserSchedule | null | undefined;
  /** (QL-193) Cumpleaños de ESE día. Lista: varias personas pueden coincidir. */
  birthdays: Birthday[];
  /** (QL-199) Ausencias que tocan ESE día, con su posición dentro del rango. */
  absences: AbsenceOnDay[];
}

/**
 * Celda de día: festivo (nombre + no-laborable), turnos de la malla, o no-laborable. Un festivo
 * **manda** sobre los turnos (ese día no se trabaja, igual que el motor de tiempo hábil del
 * backend). Con malla, el día es laborable sii tiene turnos (incluye el sábado intermedio); sin
 * malla, se cae al fin de semana de la config para el estilo de no-laborable.
 */
function DayCell({ cell, holiday, schedule, birthdays, absences }: DayCellProps) {
  const { day, inMonth, isToday, isWeekend } = cell;

  const date = useMemo(() => parseYmdLocal(cell.key), [cell.key]);
  const shifts = useMemo(
    () => (holiday || !date ? [] : shiftsForDay(schedule, date)),
    [holiday, date, schedule],
  );

  const hasShifts = shifts.length > 0;
  // (QL-193) Los cumpleaños NO entran aquí a propósito: son un evento del día, no cambian si se
  // trabaja o no. Mezclarlos convertiría un cumpleaños en un día no laborable.
  const nonWorking = !!holiday || (schedule ? !hasShifts : isWeekend);

  // (QL-199) Las ausencias tampoco entran en `nonWorking`: alguien de vacaciones no convierte el
  // día en no laborable para el resto, y el backend no las cuenta en los días hábiles.
  const tooltip = [
    holiday?.name,
    ...birthdays.map((b) => `🎂 ${b.name}`),
    // Solo `name` y `typeLabel`, que es lo que la API da (el tipo llega ya enmascarado si tocaba).
    ...absences.map((a) => `${a.absence.name}: ${a.absence.typeLabel}`),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      title={tooltip || undefined}
      className={cn(
        'flex min-h-20 flex-col gap-1 border-r border-outline-variant/20 p-1.5 last:border-r-0 sm:min-h-24',
        !inMonth && 'bg-surface-container-lowest/40',
        inMonth && holiday && 'bg-secondary-container/50',
        inMonth && !holiday && nonWorking && 'bg-surface-container-high/50',
      )}
    >
      <span className="flex justify-end">
        <span
          className={cn(
            'inline-flex size-5 items-center justify-center rounded-full text-[11px] tabular-nums',
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

      {inMonth && holiday && (
        <span className="line-clamp-2 rounded bg-secondary-container px-1 py-0.5 text-[10px] leading-tight font-medium text-on-secondary-container">
          {holiday.name}
        </span>
      )}

      {inMonth && !holiday && hasShifts && (
        <div className="flex flex-col gap-0.5">
          {shifts.map((shift) => (
            <ShiftPill key={shift.id} shift={shift} />
          ))}
        </div>
      )}

      {/* (QL-193) Chip de cumpleaños. Se pinta SIEMPRE que haya, incluso en festivo o sin turnos:
          la gente cumple años los festivos también. Estilo BIRTHDAY_CHIP compartido con la otra
          vista — ver allí por qué se distingue por forma y no por color. */}
      {inMonth && birthdays.length > 0 && (
        <span className={BIRTHDAY_CHIP}>
          <Cake className="size-3 shrink-0 text-primary" aria-hidden />
          <span className="truncate">
            {birthdays.length === 1 ? birthdays[0].name : `${birthdays.length} cumpleaños`}
          </span>
        </span>
      )}

      {/* (QL-199) Ausencias del día: barra continua, pegada al borde de la celda para que los
          días consecutivos de un mismo periodo se lean como un tramo. Se pinta aunque sea festivo
          o día sin turno: la ausencia existe igual. */}
      {inMonth && absences.length > 0 && (
        <AbsenceDayChip entries={absences} className="-mx-1.5 mt-auto" />
      )}
    </div>
  );
}

/**
 * Pill de un turno: nombre + rango horario, con el color del turno (hex definido por el ADMIN)
 * como acento de borde y punto. El fondo del pill usa tokens M3 para garantizar contraste; el
 * color del turno solo acentúa, así que un hex arbitrario nunca compromete la legibilidad.
 */
function ShiftPill({ shift }: { shift: ResolvedShift }) {
  return (
    <span
      className="flex flex-col rounded border-l-2 bg-primary-container/60 px-1 py-0.5 text-[10px] leading-tight text-on-primary-container"
      style={{ borderLeftColor: shift.color ?? 'var(--color-primary)' }}
    >
      <span className="flex items-center gap-1 font-medium">
        {shift.color && (
          <span
            className="inline-block size-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: shift.color }}
            aria-hidden
          />
        )}
        <span className="truncate">{shift.name}</span>
      </span>
      <span className="tabular-nums text-on-primary-container/80">
        {formatShiftRange(shift)}
      </span>
    </span>
  );
}
