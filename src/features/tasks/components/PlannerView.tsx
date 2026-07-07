import { useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Lock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import { useColumns } from '@/features/columns/hooks/use-columns';

import { useTasks } from '../hooks/use-tasks';
import type { Task } from '../services/tasks.service';
import { labelPill } from '../lib/palette';
import {
  addMonths,
  buildMonthGrid,
  groupTasksByDay,
  monthLabel,
  undatedTasks,
  WEEKDAY_LABELS,
  type PlannerDay,
} from '../lib/planner';
import { TaskDetailDialog } from './TaskDetailDialog';

interface PlannerViewProps {
  projectId: string;
  /** Filtro del board compartido; se aplica a las tareas tras cargarlas. Default: identidad. */
  filterTasks?: (tasks: Task[]) => Task[];
}

/** Máximo de chips visibles por celda antes de mostrar "+N más". */
const MAX_CHIPS = 3;

/**
 * Vista Planner (calendario mensual) del proyecto. Reutiliza `useTasks` (mismo dato que el
 * board) y coloca cada tarea en su **fecha límite** (`dueDate`, con `startDate` como fallback)
 * dentro de una grilla de semanas de lunes a domingo. Cada tarea es un chip coloreado por su
 * columna (`labelPill`); un click abre el mismo `TaskDetailDialog` del board. Las tareas sin
 * fecha se listan aparte. Navegación por mes con ‹ / › y "Hoy".
 */
export function PlannerView({ projectId, filterTasks }: PlannerViewProps) {
  const {
    data: rawTasks,
    isLoading: tasksLoading,
    isError: tasksError,
    error: tasksErrorObj,
  } = useTasks(projectId);
  const { data: columns, isLoading: columnsLoading } = useColumns(projectId);

  const tasks = useMemo(
    () => (filterTasks ? filterTasks(rawTasks ?? []) : rawTasks),
    [rawTasks, filterTasks],
  );

  const today = useMemo(() => new Date(), []);
  const [{ year, month }, setMonth] = useState({
    year: today.getFullYear(),
    month: today.getMonth(),
  });
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [showUndated, setShowUndated] = useState(false);

  // columnId → clases del chip (misma paleta que el board; deriva por índice si no hay color).
  const chipClassByColumn = useMemo(() => {
    const map = new Map<string, string>();
    columns?.forEach((c, i) => map.set(c.id, labelPill(c.color, i)));
    return map;
  }, [columns]);

  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const tasksByDay = useMemo(() => groupTasksByDay(tasks ?? []), [tasks]);
  const undated = useMemo(() => undatedTasks(tasks ?? []), [tasks]);

  const isLoading = tasksLoading || columnsLoading;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-64 rounded-lg" />
        <Skeleton className="h-96 rounded-xl" />
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

  const goToday = () =>
    setMonth({ year: today.getFullYear(), month: today.getMonth() });
  const shift = (delta: number) =>
    setMonth((prev) => addMonths(prev.year, prev.month, delta));

  const openTask = (id: string) => setOpenTaskId(id);

  return (
    <div>
      {/* Barra de navegación de mes */}
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
          {WEEKDAY_LABELS.map((label) => (
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
              <DayCell
                key={cell.key}
                cell={cell}
                tasks={tasksByDay.get(cell.key) ?? []}
                chipClassByColumn={chipClassByColumn}
                onOpen={openTask}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Tareas sin fecha */}
      {undated.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowUndated((v) => !v)}
            className="text-sm font-medium text-on-surface-variant hover:text-on-surface"
          >
            {undated.length}{' '}
            {undated.length === 1 ? 'tarea sin fecha' : 'tareas sin fecha'} ·{' '}
            {showUndated ? 'Ocultar' : 'Ver'}
          </button>
          {showUndated && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {undated.map((task) => (
                <TaskChip
                  key={task.id}
                  task={task}
                  className={chipClassByColumn.get(task.columnId)}
                  onOpen={openTask}
                />
              ))}
            </div>
          )}
        </div>
      )}

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

interface DayCellProps {
  cell: PlannerDay;
  tasks: Task[];
  chipClassByColumn: Map<string, string>;
  onOpen: (id: string) => void;
}

/** Celda de un día: número + hasta MAX_CHIPS chips de tarea + "+N más" en un popover. */
function DayCell({ cell, tasks, chipClassByColumn, onOpen }: DayCellProps) {
  const visible = tasks.slice(0, MAX_CHIPS);
  const overflow = tasks.slice(MAX_CHIPS);

  return (
    <div
      className={cn(
        'min-h-24 border-r border-outline-variant/20 p-1.5 last:border-r-0',
        cell.inMonth ? 'bg-surface' : 'bg-surface-container-low/40',
        cell.isWeekend && cell.inMonth && 'bg-surface-container-low/30',
      )}
    >
      <div className="mb-1 flex justify-end">
        <span
          className={cn(
            'inline-flex size-6 items-center justify-center rounded-full text-xs',
            cell.isToday
              ? 'bg-primary font-semibold text-on-primary'
              : cell.inMonth
                ? 'text-on-surface'
                : 'text-on-surface-variant/50',
          )}
        >
          {cell.day}
        </span>
      </div>

      <div className="space-y-1">
        {visible.map((task) => (
          <TaskChip
            key={task.id}
            task={task}
            className={chipClassByColumn.get(task.columnId)}
            onOpen={onOpen}
          />
        ))}

        {overflow.length > 0 && (
          <Popover>
            <PopoverTrigger className="w-full rounded px-1.5 py-0.5 text-left text-[11px] font-medium text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface">
              +{overflow.length} más
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56 space-y-1">
              <p className="mb-1 text-xs font-medium text-on-surface-variant">
                {tasks.length} tareas
              </p>
              {tasks.map((task) => (
                <TaskChip
                  key={task.id}
                  task={task}
                  className={chipClassByColumn.get(task.columnId)}
                  onOpen={onOpen}
                />
              ))}
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}

interface TaskChipProps {
  task: Task;
  className: string | undefined;
  onOpen: (id: string) => void;
}

/** Chip compacto de una tarea dentro del calendario. */
function TaskChip({ task, className, onOpen }: TaskChipProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(task.id)}
      title={task.title}
      className={cn(
        'flex w-full items-center gap-1 rounded px-1.5 py-0.5 text-left text-[11px] font-medium transition-opacity focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary',
        className ?? 'bg-palette-gray-surface text-palette-gray-on-surface',
        task.isCompleted && 'opacity-60',
      )}
    >
      {task.isCompleted && (
        <CheckCircle2 className="size-3 shrink-0" aria-label="Completada" />
      )}
      <span className={cn('truncate', task.isCompleted && 'line-through')}>
        {task.title}
      </span>
      {task.deadlineLocked && (
        <Lock className="ml-auto size-2.5 shrink-0" aria-label="Fecha bloqueada" />
      )}
    </button>
  );
}
