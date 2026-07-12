import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import {
  CalendarOff,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Flag,
  FlagTriangleRight,
  Lock,
  Sparkles,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import { useColumns } from '@/features/columns/hooks/use-columns';
import type { Project } from '@/features/projects/types/project';

import { useTasks } from '../hooks/use-tasks';
import type { Task } from '../services/tasks.service';
import { labelPill } from '../lib/palette';
import {
  addMonths,
  buildMonthGrid,
  buildMilestones,
  groupMilestonesByDay,
  groupTasksByDay,
  monthLabel,
  monthsRange,
  rangeLabel,
  undatedTasks,
  WEEKDAY_LABELS,
  type Milestone,
  type MilestoneKind,
  type PlannerDay,
} from '../lib/planner';
import { TaskDetailDialog } from './TaskDetailDialog';

interface PlannerViewProps {
  projectId: string;
  /** Filtro del board compartido; se aplica a las tareas tras cargarlas. Default: identidad. */
  filterTasks?: (tasks: Task[]) => Task[];
  /** Proyecto (QL-71): origina los hitos creado/inicio/fin. Si falta, no se pintan. */
  project?: Project;
}

/** Máximo de chips visibles por celda antes de mostrar "+N más". */
const MAX_CHIPS = 3;

/** Opciones del selector multi-mes (QL-71): nº de meses consecutivos a mostrar. */
const RANGE_OPTIONS: { count: number; label: string }[] = [
  { count: 1, label: '1 mes' },
  { count: 3, label: '3 meses' },
];

/**
 * Estilo de cada hito (QL-71, contraste QL-109): icono + tokens M3. Deliberadamente distinto de
 * un chip de tarea (borde izquierdo marcado + semibold + icono) para que se lean como eventos
 * clave.
 *
 * QL-109: los hitos de **proyecto** usan el set **`*-fixed`** de M3 —pensado para chips de acento
 * con contraste texto/fondo garantizado y estable en claro **y** oscuro (más opaco que los
 * `*-container`, que en el tema Neon Tokyo quedaban translúcidos y se confundían con la celda)—;
 * los de **tarea** usan `surface-container-highest` (más separado del fondo de la celda) con
 * `on-surface` (máximo contraste). Cada tipo mantiene su color de borde/icono distintivo.
 */
const MILESTONE_STYLE: Record<
  MilestoneKind,
  { icon: ReactNode; className: string }
> = {
  'project-created': {
    icon: <Sparkles className="size-3 shrink-0" />,
    className: 'border-l-secondary bg-secondary-fixed text-on-secondary-fixed',
  },
  'project-start': {
    icon: <Flag className="size-3 shrink-0" />,
    className: 'border-l-tertiary bg-tertiary-fixed text-on-tertiary-fixed',
  },
  'project-end': {
    icon: <FlagTriangleRight className="size-3 shrink-0" />,
    className: 'border-l-primary bg-primary-fixed text-on-primary-fixed',
  },
  'task-start': {
    icon: <CircleDot className="size-3 shrink-0" />,
    className: 'border-l-outline bg-surface-container-highest text-on-surface',
  },
  'task-end': {
    icon: <CheckCircle2 className="size-3 shrink-0" />,
    className: 'border-l-outline bg-surface-container-highest text-on-surface',
  },
};

/**
 * Vista Planner (calendario) del proyecto (QL-71). Reutiliza `useTasks` (mismo dato que el
 * board) y coloca cada tarea en su **fecha límite** (`dueDate`, con `startDate` de fallback)
 * en una grilla lun–dom. Cada tarea es un chip coloreado por su columna (`labelPill`); un
 * click abre el mismo `TaskDetailDialog` del board. Además:
 * - **Multi-mes:** se pueden ver 1 ó 3 meses seguidos.
 * - **Hitos:** eventos clave del proyecto (creado/inicio/fin) y de tareas (inicio/fin, QL-62)
 *   con estilo de banderín, distinto al de las tareas. Se pueden ocultar.
 * Las tareas sin fecha se listan aparte.
 */
export function PlannerView({ projectId, filterTasks, project }: PlannerViewProps) {
  const {
    data: rawTasks,
    isLoading: tasksLoading,
    isError: tasksError,
    error: tasksErrorObj,
  } = useTasks(projectId);
  const { data: columns, isLoading: columnsLoading } = useColumns(projectId);

  const tasks = useMemo(
    () => (filterTasks ? filterTasks(rawTasks ?? []) : (rawTasks ?? [])),
    [rawTasks, filterTasks],
  );

  const today = useMemo(() => new Date(), []);
  const [{ year, month }, setAnchor] = useState({
    year: today.getFullYear(),
    month: today.getMonth(),
  });
  const [monthsToShow, setMonthsToShow] = useState(1);
  const [showMilestones, setShowMilestones] = useState(true);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [showUndated, setShowUndated] = useState(false);

  // columnId → clases del chip (misma paleta que el board; deriva por índice si no hay color).
  const chipClassByColumn = useMemo(() => {
    const map = new Map<string, string>();
    columns?.forEach((c, i) => map.set(c.id, labelPill(c.color, i)));
    return map;
  }, [columns]);

  const tasksByDay = useMemo(() => groupTasksByDay(tasks), [tasks]);
  const undated = useMemo(() => undatedTasks(tasks), [tasks]);
  const milestonesByDay = useMemo(
    () => groupMilestonesByDay(buildMilestones(project, tasks)),
    [project, tasks],
  );
  const months = useMemo(
    () => monthsRange(year, month, monthsToShow),
    [year, month, monthsToShow],
  );

  const isLoading = tasksLoading || columnsLoading;

  if (isLoading) {
    return (
      <div className="mt-4 space-y-3">
        <Skeleton className="h-9 w-64 rounded-lg" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (tasksError) {
    return (
      <div className="mt-4 rounded-lg border border-error/20 bg-error-container px-4 py-3 text-sm font-medium text-on-error-container">
        {tasksErrorObj instanceof Error
          ? tasksErrorObj.message
          : 'No se pudieron cargar las tareas'}
      </div>
    );
  }

  const goToday = () =>
    setAnchor({ year: today.getFullYear(), month: today.getMonth() });
  const shift = (dir: number) =>
    setAnchor((prev) => addMonths(prev.year, prev.month, dir * monthsToShow));

  const openTask = (id: string) => setOpenTaskId(id);
  const showMultiMonth = monthsToShow > 1;

  return (
    <div className="mt-4">
      {/* Barra de control: rango visible + selector multi-mes + hitos + navegación */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-on-surface capitalize">
          {rangeLabel(year, month, monthsToShow)}
        </h2>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* Selector multi-mes */}
          <div
            role="group"
            aria-label="Meses a mostrar"
            className="flex rounded-lg bg-surface-container-low p-1"
          >
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.count}
                type="button"
                onClick={() => setMonthsToShow(opt.count)}
                aria-pressed={monthsToShow === opt.count}
                className={cn(
                  'rounded-md px-2.5 py-1 text-sm font-medium transition-colors',
                  monthsToShow === opt.count
                    ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <Button
            variant={showMilestones ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setShowMilestones((v) => !v)}
            aria-pressed={showMilestones}
          >
            <Flag className="size-4" />
            Hitos
          </Button>

          <Button variant="outline" size="sm" onClick={goToday}>
            Hoy
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label={showMultiMonth ? 'Rango anterior' : 'Mes anterior'}
            onClick={() => shift(-1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label={showMultiMonth ? 'Rango siguiente' : 'Mes siguiente'}
            onClick={() => shift(1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Leyenda de hitos (solo si hay proyecto y están visibles). */}
      {showMilestones && project && (
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-on-surface-variant">
          <span className="font-medium">Hitos:</span>
          <LegendItem kind="project-created" label="Creado" />
          <LegendItem kind="project-start" label="Inicio" />
          <LegendItem kind="project-end" label="Fin" />
        </div>
      )}

      {/* Calendarios (uno por mes visible). */}
      <div className={cn(showMultiMonth && 'space-y-5')}>
        {months.map((ym) => (
          <MonthCalendar
            key={`${ym.year}-${ym.month}`}
            year={ym.year}
            month={ym.month}
            showCaption={showMultiMonth}
            tasksByDay={tasksByDay}
            milestonesByDay={showMilestones ? milestonesByDay : undefined}
            chipClassByColumn={chipClassByColumn}
            onOpen={openTask}
          />
        ))}
      </div>

      {tasks.length === 0 && (
        <p className="mt-4 flex items-center gap-2 text-sm text-on-surface-variant">
          <CalendarOff className="size-4" />
          Este proyecto aún no tiene tareas que planificar.
        </p>
      )}

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

interface MonthCalendarProps {
  year: number;
  month: number;
  /** Muestra el nombre del mes sobre la grilla (útil en la vista multi-mes). */
  showCaption: boolean;
  tasksByDay: Map<string, Task[]>;
  /** `undefined` = hitos ocultos. */
  milestonesByDay: Map<string, Milestone[]> | undefined;
  chipClassByColumn: Map<string, string>;
  onOpen: (id: string) => void;
}

/** Una grilla mensual completa (cabecera lun–dom + semanas). */
function MonthCalendar({
  year,
  month,
  showCaption,
  tasksByDay,
  milestonesByDay,
  chipClassByColumn,
  onOpen,
}: MonthCalendarProps) {
  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);

  return (
    <section>
      {showCaption && (
        <h3 className="mb-1.5 text-sm font-semibold text-on-surface capitalize">
          {monthLabel(year, month)}
        </h3>
      )}
      <div className="overflow-hidden rounded-xl border border-outline-variant/40 bg-surface">
        {/* Cabecera de días de la semana */}
        <div className="grid grid-cols-7 border-b border-outline-variant/40 bg-surface-container-low">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="px-2 py-2 text-center text-xs font-semibold tracking-wide text-on-surface-variant uppercase"
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
                milestones={milestonesByDay?.get(cell.key) ?? []}
                chipClassByColumn={chipClassByColumn}
                onOpen={onOpen}
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

interface DayCellProps {
  cell: PlannerDay;
  tasks: Task[];
  milestones: Milestone[];
  chipClassByColumn: Map<string, string>;
  onOpen: (id: string) => void;
}

/** Celda de un día: número + banderines de hito + hasta MAX_CHIPS chips + "+N más". */
function DayCell({
  cell,
  tasks,
  milestones,
  chipClassByColumn,
  onOpen,
}: DayCellProps) {
  const visible = tasks.slice(0, MAX_CHIPS);
  const overflow = tasks.slice(MAX_CHIPS);

  return (
    <div
      className={cn(
        'min-h-24 border-r border-outline-variant/20 p-1.5 transition-colors last:border-r-0 md:min-h-28',
        cell.inMonth
          ? 'bg-surface hover:bg-surface-container-low/60'
          : 'bg-surface-container-low/40 text-on-surface-variant',
        cell.isWeekend && cell.inMonth && 'bg-surface-container-low/25',
        cell.isToday && 'bg-primary/5 ring-1 ring-inset ring-primary/30',
      )}
    >
      <div className="mb-1 flex justify-end">
        <span
          className={cn(
            'inline-flex size-6 items-center justify-center rounded-full text-xs tabular-nums',
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
        {milestones.map((m, i) => (
          <MilestoneFlag key={`${m.kind}-${m.taskId ?? i}`} milestone={m} onOpen={onOpen} />
        ))}

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

interface MilestoneFlagProps {
  milestone: Milestone;
  onOpen: (id: string) => void;
}

/**
 * Banderín de un hito. Estilo intencionalmente distinto de `TaskChip` (borde izquierdo
 * marcado, semibold, icono). Si tiene `taskId` es clicable y abre el detalle de la tarea;
 * si es un hito de proyecto se renderiza estático (con tooltip nativo).
 */
function MilestoneFlag({ milestone, onOpen }: MilestoneFlagProps) {
  const style = MILESTONE_STYLE[milestone.kind];
  const base = cn(
    'flex w-full items-center gap-1 rounded-md border-l-2 px-1.5 py-0.5 text-left text-[11px] font-semibold',
    style.className,
  );

  if (milestone.taskId) {
    const taskId = milestone.taskId;
    return (
      <button
        type="button"
        onClick={() => onOpen(taskId)}
        title={milestone.label}
        className={cn(
          base,
          'transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary',
        )}
      >
        {style.icon}
        <span className="truncate">{milestone.label}</span>
      </button>
    );
  }

  return (
    <div className={base} title={milestone.label}>
      {style.icon}
      <span className="truncate">{milestone.label}</span>
    </div>
  );
}

interface LegendItemProps {
  kind: MilestoneKind;
  label: string;
}

/** Ítem de la leyenda de hitos (mismo estilo que el banderín, en miniatura). */
function LegendItem({ kind, label }: LegendItemProps) {
  const style = MILESTONE_STYLE[kind];
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={cn(
          'inline-flex items-center rounded-md border-l-2 px-1 py-0.5',
          style.className,
        )}
      >
        {style.icon}
      </span>
      {label}
    </span>
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
        'flex w-full items-center gap-1 rounded px-1.5 py-0.5 text-left text-[11px] font-medium transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary',
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
