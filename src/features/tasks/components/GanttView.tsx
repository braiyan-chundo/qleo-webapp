import { useMemo, useState } from 'react';
import { CalendarClock, CheckCircle2, GanttChartSquare, Lock } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { useStages } from '@/features/stages/hooks/use-stages';
import { useColumns } from '@/features/columns/hooks/use-columns';

import { useTasks } from '../hooks/use-tasks';
import type { Task } from '../services/tasks.service';
import { columnColor } from '../lib/palette';
import { formatDueDate } from '../lib/deadline';
import {
  barGeometry,
  buildHeaderCells,
  buildSections,
  computeRange,
  headerUnit,
  todayMarkerPct,
  type GanttRange,
} from '../lib/gantt';
import { TaskDetailDialog } from './TaskDetailDialog';

interface GanttViewProps {
  projectId: string;
  /** Filtro del board compartido; se aplica a las tareas tras cargarlas. Default: identidad. */
  filterTasks?: (tasks: Task[]) => Task[];
}

/** Ancho de la columna fija de nombres de tarea (sticky a la izquierda). */
const NAME_COL = 'w-56 min-w-56 md:w-64 md:min-w-64';

/**
 * Vista Gantt (cronograma) del proyecto. Reutiliza `useTasks` (mismo dato que el board) y
 * agrupa las tareas por **etapa** (`useStages`). Cada tarea es una fila con una **barra**
 * posicionada por porcentaje entre `startDate` y `dueDate` (ver `lib/gantt.ts`); las tareas
 * con una sola fecha se dibujan como **hito** (rombo) y las que no tienen fecha caen en la
 * sección "Sin programar". La barra se colorea con el color de su columna (`columnColor`).
 * Un click en la barra/fila abre el mismo `TaskDetailDialog` del board.
 */
export function GanttView({ projectId, filterTasks }: GanttViewProps) {
  const {
    data: rawTasks,
    isLoading: tasksLoading,
    isError: tasksError,
    error: tasksErrorObj,
  } = useTasks(projectId);
  const { data: stages, isLoading: stagesLoading } = useStages(projectId);
  const { data: columns, isLoading: columnsLoading } = useColumns(projectId);

  const tasks = useMemo(
    () => (filterTasks ? filterTasks(rawTasks ?? []) : rawTasks),
    [rawTasks, filterTasks],
  );

  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  // Índice de columna → clase de color de la barra (misma paleta que el board).
  const columnBarClass = useMemo(() => {
    const map = new Map<string, string>();
    columns?.forEach((c, i) => map.set(c.id, columnColor(c.color, i)));
    return map;
  }, [columns]);

  const range = useMemo(() => computeRange(tasks ?? []), [tasks]);
  const sections = useMemo(
    () => buildSections(tasks ?? [], stages ?? []),
    [tasks, stages],
  );

  const isLoading = tasksLoading || stagesLoading || columnsLoading;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-11 rounded-lg" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 rounded-lg" />
        ))}
      </div>
    );
  }

  if (tasksError) {
    return (
      <div className="rounded-lg border border-error/20 bg-error-container px-4 py-3 text-sm font-medium text-on-error-container">
        {tasksErrorObj instanceof Error
          ? tasksErrorObj.message
          : 'No se pudieron cargar las tareas'}
      </div>
    );
  }

  // Estado vacío: ninguna tarea con fecha (no hay rango que dibujar).
  if (!range) {
    return (
      <div className="mt-10 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-outline-variant/60 px-6 py-20 text-center">
        <GanttChartSquare className="size-10 text-on-surface-variant" />
        <p className="text-sm font-medium text-on-surface">Cronograma vacío</p>
        <p className="max-w-sm text-xs text-on-surface-variant">
          Ninguna tarea tiene fechas para el cronograma. Asigna fecha de inicio/límite a las
          tareas.
        </p>
      </div>
    );
  }

  const unit = headerUnit(range);
  const headerCells = buildHeaderCells(range, unit);
  const todayPct = todayMarkerPct(range);

  // Ancho mínimo de la pista temporal: garantiza ~28px/día para que las barras sean legibles
  // y active el scroll horizontal cuando el rango es amplio (la columna de nombres es sticky).
  const trackMinWidth = Math.max(range.totalDays * 28, 480);

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-sm text-on-surface-variant">
        <CalendarClock className="size-4" />
        <span>
          {formatDueDate(range.start.toISOString())} — {formatDueDate(range.end.toISOString())}
          {unit === 'week' && ' · vista por semanas'}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-outline-variant/40 bg-surface">
        <div className="min-w-max">
          {/* Encabezado: columna de nombres + pista temporal */}
          <div className="flex border-b border-outline-variant/40 bg-surface-container-low">
            <div
              className={cn(
                NAME_COL,
                'sticky left-0 z-20 flex items-center border-r border-outline-variant/40 bg-surface-container-low px-3 py-2 text-xs font-medium text-on-surface-variant',
              )}
            >
              Tarea
            </div>
            <div
              className="relative h-9"
              style={{ width: trackMinWidth, minWidth: trackMinWidth }}
            >
              {headerCells.map((cell) => (
                <div
                  key={cell.key}
                  className={cn(
                    'absolute top-0 flex h-full flex-col items-center justify-center overflow-hidden border-l border-outline-variant/20 text-[10px] leading-none',
                    cell.isWeekend && 'bg-surface-container/40',
                    cell.isToday && 'bg-primary/10',
                  )}
                  style={{ left: `${cell.leftPct}%`, width: `${cell.widthPct}%` }}
                >
                  {cell.subLabel && (
                    <span className="font-semibold text-on-surface">{cell.subLabel}</span>
                  )}
                  <span
                    className={cn(
                      cell.isToday ? 'font-semibold text-primary' : 'text-on-surface-variant',
                    )}
                  >
                    {cell.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Cuerpo: secciones por etapa. La línea de "Hoy" se dibuja por fila dentro de
              cada pista temporal (ver GanttRow), de modo que queda alineada con las barras. */}
          <div>
            {sections.map((section) => (
              <div key={section.id}>
                <div className="min-w-full border-t border-outline-variant/40 bg-surface-container px-3 py-1.5 text-xs font-semibold text-on-surface">
                  <span className="sticky left-3">{section.name}</span>
                </div>

                {section.scheduled.map((task) => (
                  <GanttRow
                    key={task.id}
                    task={task}
                    range={range}
                    trackMinWidth={trackMinWidth}
                    todayPct={todayPct}
                    barClass={columnBarClass.get(task.columnId)}
                    onOpen={() => setOpenTaskId(task.id)}
                  />
                ))}

                {section.unscheduled.map((task) => (
                  <UnscheduledRow
                    key={task.id}
                    task={task}
                    onOpen={() => setOpenTaskId(task.id)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <TaskDetailDialog
        taskId={openTaskId}
        projectId={projectId}
        onOpenChange={(o) => {
          if (!o) setOpenTaskId(null);
        }}
      />
    </div>
  );
}

interface GanttRowProps {
  task: Task;
  range: GanttRange;
  trackMinWidth: number;
  todayPct: number | null;
  barClass: string | undefined;
  onOpen: () => void;
}

/** Fila de una tarea con fecha: nombre + barra/hito posicionado en la pista temporal. */
function GanttRow({ task, range, trackMinWidth, todayPct, barClass, onOpen }: GanttRowProps) {
  const geom = barGeometry(task, range);
  if (!geom) return null;

  const rangeLabel = describeRange(task);
  const barColor = barClass ?? 'bg-palette-gray-dot';

  return (
    <div className="group flex border-t border-outline-variant/30 hover:bg-surface-container-low/60">
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          NAME_COL,
          'sticky left-0 z-10 flex items-center gap-1.5 border-r border-outline-variant/40 bg-surface px-3 py-2 text-left text-sm text-on-surface transition-colors group-hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary',
        )}
        aria-label={`Abrir tarea ${task.title}`}
      >
        {task.isCompleted && (
          <CheckCircle2 className="size-3.5 shrink-0 text-tertiary" aria-label="Completada" />
        )}
        <span className={cn('truncate', task.isCompleted && 'text-on-surface-variant line-through')}>
          {task.title}
        </span>
        {task.deadlineLocked && (
          <Lock className="ml-auto size-3 shrink-0 text-on-surface-variant" aria-label="Fecha bloqueada" />
        )}
      </button>

      <div
        className="relative h-10"
        style={{ width: trackMinWidth, minWidth: trackMinWidth }}
      >
        {todayPct !== null && (
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-0 w-px bg-primary/50"
            style={{ left: `${todayPct}%` }}
            aria-hidden
          />
        )}

        {geom.milestone ? (
          <button
            type="button"
            onClick={onOpen}
            title={rangeLabel}
            aria-label={`${task.title} — ${rangeLabel}`}
            className="absolute top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            style={{ left: `${geom.leftPct}%` }}
          >
            <span
              className={cn(
                'block size-3 rotate-45 rounded-[2px] border border-surface',
                barColor,
                task.isCompleted && 'opacity-50',
              )}
            />
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpen}
            title={rangeLabel}
            aria-label={`${task.title} — ${rangeLabel}`}
            className="absolute top-1/2 z-[1] flex h-5 -translate-y-1/2 items-center overflow-hidden rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            style={{ left: `${geom.leftPct}%`, width: `max(${geom.widthPct}%, 0.5rem)` }}
          >
            <span
              className={cn(
                'flex h-full w-full items-center gap-1 px-1.5 transition-opacity',
                barColor,
                task.isCompleted ? 'opacity-50' : 'group-hover:brightness-110',
              )}
            >
              {task.isCompleted && (
                <CheckCircle2 className="size-3 shrink-0 text-on-surface" aria-hidden />
              )}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

interface UnscheduledRowProps {
  task: Task;
  onOpen: () => void;
}

/** Fila de una tarea sin fecha (sección "Sin programar"): lista simple, sin barra. */
function UnscheduledRow({ task, onOpen }: UnscheduledRowProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-w-full items-center gap-1.5 border-t border-outline-variant/30 bg-surface px-3 py-2 text-left text-sm text-on-surface-variant transition-colors hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
      aria-label={`Abrir tarea ${task.title}`}
    >
      <span className="sticky left-3 flex items-center gap-1.5">
        {task.isCompleted && (
          <CheckCircle2 className="size-3.5 shrink-0 text-tertiary" aria-label="Completada" />
        )}
        <span className={cn('truncate', task.isCompleted && 'line-through')}>{task.title}</span>
      </span>
    </button>
  );
}

/** Texto legible del rango de fechas de una tarea para el `title`/`aria-label`. */
function describeRange(task: Task): string {
  const start = task.startDate ? formatDueDate(task.startDate) : null;
  const due = task.dueDate ? formatDueDate(task.dueDate) : null;
  if (start && due) return `${start} → ${due}`;
  if (due) return `Vence ${due}`;
  if (start) return `Inicia ${start}`;
  return 'Sin fechas';
}
