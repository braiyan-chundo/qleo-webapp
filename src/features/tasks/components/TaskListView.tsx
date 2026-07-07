import { useMemo, useState } from 'react';
import { ArrowUpDown, CheckCircle2, Download, Lock, Search } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { AuthedAvatar } from '@/shared/components/AuthedAvatar';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DataCard,
  DataCardRow,
  DataTableCard,
} from '@/shared/components/data-table';
import { cn } from '@/lib/utils';

import { useStages } from '@/features/stages/hooks/use-stages';
import { useColumns } from '@/features/columns/hooks/use-columns';
import {
  useQueryParamSearch,
  useQueryParamState,
} from '@/shared/hooks/use-query-param-state';

import { useTasks } from '../hooks/use-tasks';
import type { Task, TaskAssignment } from '../services/tasks.service';
import { formatDueDate, isOverdue } from '../lib/deadline';
import {
  buildCsvFilename,
  buildTasksCsv,
  downloadCsv,
  type TaskCsvRow,
} from '../lib/export-csv';
import { TaskDetailDialog } from './TaskDetailDialog';

interface TaskListViewProps {
  projectId: string;
  /** Código del proyecto, para nombrar el CSV exportado. */
  projectCode?: string;
}

/** Valor sentinela para "sin responsable" en el select (los ids reales nunca son vacíos). */
const NO_ASSIGNEE = '__none__';

/** El ASSIGNEE (Responsable único, RF-1.2) de una tarea, si existe. */
function assigneeOf(task: Task): TaskAssignment | undefined {
  return task.assignments.find((a) => a.role === 'ASSIGNEE');
}

type SortKey = 'status' | 'title' | 'dueDate';
type SortDir = 'asc' | 'desc';

/**
 * Vista Lista de las tareas del proyecto (QL-16). Reutiliza `useTasks` (no repagina) y
 * aplica **filtros client-side combinados (AND)** más ordenación simple; exporta a CSV las
 * tareas actualmente filtradas. Un click en la fila abre el mismo `TaskDetailDialog` del
 * tablero.
 */
export function TaskListView({ projectId, projectCode }: TaskListViewProps) {
  const {
    data: tasks,
    isLoading: tasksLoading,
    isError: tasksError,
    error: tasksErrorObj,
  } = useTasks(projectId);
  const { data: columns, isLoading: columnsLoading } = useColumns(projectId);
  const { data: stages } = useStages(projectId);

  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  // Filtros persistidos en la URL. Namespaced (`l*`) para no colisionar con los filtros
  // del board (`q`/`etapa`/`resp`/`estado`) que viven en la misma URL de la página.
  const { value: search, setValue: setSearch, committed } = useQueryParamSearch('lq', 300);
  const [columnFilter, setColumnFilter] = useQueryParamState<string>('lcol', '');
  const [stageFilter, setStageFilter] = useQueryParamState<string>('letapa', '');
  const [assigneeFilter, setAssigneeFilter] = useQueryParamState<string>('lresp', '');
  const debouncedSearch = committed.toLowerCase();

  // Ordenación (por defecto: estado + order, como el Kanban).
  const [sortKey, setSortKey] = useState<SortKey>('status');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const columnName = useMemo(() => {
    const map = new Map<string, string>();
    columns?.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [columns]);

  const columnOrder = useMemo(() => {
    const map = new Map<string, number>();
    columns?.forEach((c, i) => map.set(c.id, i));
    return map;
  }, [columns]);

  const stageName = useMemo(() => {
    const map = new Map<string, string>();
    stages?.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [stages]);

  // Responsables que aparecen como ASSIGNEE en alguna tarea (deriva de `assignments`).
  const assigneeOptions = useMemo(() => {
    const map = new Map<string, string>();
    tasks?.forEach((t) => {
      const assignee = assigneeOf(t);
      if (assignee) {
        map.set(assignee.userId, assignee.user?.name ?? assignee.userId);
      }
    });
    return [...map.entries()]
      .map(([userId, name]) => ({ userId, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [tasks]);

  // Filtro combinado (AND) + ordenación.
  const filtered = useMemo(() => {
    const base = (tasks ?? []).filter((task) => {
      if (debouncedSearch && !task.title.toLowerCase().includes(debouncedSearch)) {
        return false;
      }
      if (columnFilter && task.columnId !== columnFilter) return false;
      if (stageFilter && task.stageId !== stageFilter) return false;
      if (assigneeFilter) {
        const assignee = assigneeOf(task);
        if (assigneeFilter === NO_ASSIGNEE) {
          if (assignee) return false;
        } else if (assignee?.userId !== assigneeFilter) {
          return false;
        }
      }
      return true;
    });

    const dir = sortDir === 'asc' ? 1 : -1;
    return [...base].sort((a, b) => {
      let cmp: number;
      if (sortKey === 'title') {
        cmp = a.title.localeCompare(b.title, 'es');
      } else if (sortKey === 'dueDate') {
        // Sin fecha va al final en asc; el orden lo controla `dir` sobre el timestamp.
        const ta = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
        const tb = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
        cmp = ta - tb;
      } else {
        // status = orden de la columna, y dentro de la columna por `order`.
        const ca = columnOrder.get(a.columnId) ?? Number.MAX_SAFE_INTEGER;
        const cb = columnOrder.get(b.columnId) ?? Number.MAX_SAFE_INTEGER;
        cmp = ca !== cb ? ca - cb : a.order - b.order;
      }
      return cmp * dir;
    });
  }, [
    tasks,
    debouncedSearch,
    columnFilter,
    stageFilter,
    assigneeFilter,
    sortKey,
    sortDir,
    columnOrder,
  ]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function handleExport() {
    const rows: TaskCsvRow[] = filtered.map((task) => {
      const assignee = assigneeOf(task);
      return {
        title: task.title,
        status: columnName.get(task.columnId) ?? '',
        stage: stageName.get(task.stageId) ?? '',
        assignee: assignee?.user?.name ?? (assignee ? assignee.userId : ''),
        assigneeEmail: assignee?.user?.email ?? '',
        dueDate: formatDueDate(task.dueDate),
        locked: task.deadlineLocked ? 'Sí' : 'No',
        description: task.description ?? '',
      };
    });
    downloadCsv(buildTasksCsv(rows), buildCsvFilename(projectCode));
  }

  const isLoading = tasksLoading || columnsLoading;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 rounded-lg" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
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

  const hasFilters =
    !!debouncedSearch || !!columnFilter || !!stageFilter || !!assigneeFilter;

  return (
    <div>
      {/* Barra de filtros */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-on-surface-variant" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título…"
            className="pl-8"
            aria-label="Buscar tareas por título"
          />
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-on-surface-variant">Estado</span>
          <NativeSelect
            value={columnFilter}
            onChange={(e) => setColumnFilter(e.target.value)}
            aria-label="Filtrar por estado"
          >
            <NativeSelectOption value="">Todos</NativeSelectOption>
            {columns?.map((c) => (
              <NativeSelectOption key={c.id} value={c.id}>
                {c.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-on-surface-variant">Etapa</span>
          <NativeSelect
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            aria-label="Filtrar por etapa"
          >
            <NativeSelectOption value="">Todas</NativeSelectOption>
            {stages?.map((s) => (
              <NativeSelectOption key={s.id} value={s.id}>
                {s.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-on-surface-variant">Responsable</span>
          <NativeSelect
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            aria-label="Filtrar por responsable"
          >
            <NativeSelectOption value="">Todos</NativeSelectOption>
            <NativeSelectOption value={NO_ASSIGNEE}>Sin responsable</NativeSelectOption>
            {assigneeOptions.map((o) => (
              <NativeSelectOption key={o.userId} value={o.userId}>
                {o.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>

        <Button
          type="button"
          variant="outline"
          onClick={handleExport}
          disabled={filtered.length === 0}
        >
          <Download />
          Exportar CSV
        </Button>
      </div>

      <p className="mb-3 text-sm text-on-surface-variant">
        {filtered.length} {filtered.length === 1 ? 'tarea' : 'tareas'}
      </p>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-outline-variant/60 px-4 py-8 text-center text-sm text-on-surface-variant">
          {hasFilters
            ? 'Ninguna tarea coincide con los filtros.'
            : 'Este proyecto todavía no tiene tareas.'}
        </p>
      ) : (
        <DataTableCard
          cards={filtered.map((task) => {
            const assignee = assigneeOf(task);
            const overdue = isOverdue(task.dueDate);
            const statusName = columnName.get(task.columnId);
            return (
              <DataCard
                key={task.id}
                onClick={() => setOpenTaskId(task.id)}
                ariaLabel={`Abrir tarea ${task.title}`}
              >
                <div className="flex items-start gap-2">
                  {task.isCompleted && (
                    <CheckCircle2
                      className="mt-0.5 size-4 shrink-0 text-tertiary"
                      aria-label="Completada"
                    />
                  )}
                  <span
                    className={cn(
                      'font-semibold text-on-surface',
                      task.isCompleted &&
                        'text-on-surface-variant line-through',
                    )}
                  >
                    {task.title}
                  </span>
                </div>
                <DataCardRow label="Estado">
                  {statusName ? (
                    <Badge className="bg-surface-container-high text-on-surface-variant">
                      {statusName}
                    </Badge>
                  ) : (
                    '—'
                  )}
                </DataCardRow>
                <DataCardRow label="Etapa">
                  {stageName.get(task.stageId) ?? '—'}
                </DataCardRow>
                <DataCardRow label="Responsable">
                  {assignee ? (
                    <span className="inline-flex items-center gap-2">
                      <AuthedAvatar
                        size="sm"
                        avatarDownloadUrl={assignee.user?.avatarDownloadUrl}
                        avatarUrl={assignee.user?.avatarUrl}
                        name={assignee.user?.name ?? assignee.userId}
                      />
                      {assignee.user?.name ?? assignee.userId}
                    </span>
                  ) : (
                    '—'
                  )}
                </DataCardRow>
                <DataCardRow label="Fecha límite">
                  {task.dueDate ? (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5',
                        overdue ? 'text-error' : 'text-on-surface',
                      )}
                    >
                      {formatDueDate(task.dueDate)}
                      {task.deadlineLocked && (
                        <Lock className="size-3.5" aria-label="Fecha bloqueada" />
                      )}
                    </span>
                  ) : (
                    '—'
                  )}
                </DataCardRow>
              </DataCard>
            );
          })}
        >
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortButton
                    label="Título"
                    active={sortKey === 'title'}
                    dir={sortDir}
                    onClick={() => toggleSort('title')}
                  />
                </TableHead>
                <TableHead>
                  <SortButton
                    label="Estado"
                    active={sortKey === 'status'}
                    dir={sortDir}
                    onClick={() => toggleSort('status')}
                  />
                </TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead>Responsable</TableHead>
                <TableHead>
                  <SortButton
                    label="Fecha límite"
                    active={sortKey === 'dueDate'}
                    dir={sortDir}
                    onClick={() => toggleSort('dueDate')}
                  />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  statusName={columnName.get(task.columnId)}
                  stageLabel={stageName.get(task.stageId)}
                  onOpen={() => setOpenTaskId(task.id)}
                />
              ))}
            </TableBody>
        </DataTableCard>
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

interface SortButtonProps {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}

/** Encabezado de columna con ordenación clicable. */
function SortButton({ label, active, dir, onClick }: SortButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-sm text-left font-medium transition-colors hover:text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        active ? 'text-on-surface' : 'text-on-surface-variant',
      )}
      aria-label={`Ordenar por ${label}${active ? (dir === 'asc' ? ' (ascendente)' : ' (descendente)') : ''}`}
    >
      {label}
      <ArrowUpDown className="size-3.5 opacity-70" />
    </button>
  );
}

interface TaskRowProps {
  task: Task;
  statusName?: string;
  stageLabel?: string;
  onOpen: () => void;
}

/** Fila de tarea: click en cualquier parte abre el detalle. */
function TaskRow({ task, statusName, stageLabel, onOpen }: TaskRowProps) {
  const assignee = assigneeOf(task);
  const overdue = isOverdue(task.dueDate);

  return (
    <TableRow
      className="cursor-pointer"
      onClick={onOpen}
      tabIndex={0}
      role="button"
      aria-label={`Abrir tarea ${task.title}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <TableCell className="max-w-[20rem] font-medium text-on-surface">
        <span className="flex items-center gap-1.5">
          {task.isCompleted && (
            <CheckCircle2
              className="size-4 shrink-0 text-tertiary"
              aria-label="Completada"
            />
          )}
          <span
            className={cn(
              'truncate',
              task.isCompleted && 'text-on-surface-variant line-through',
            )}
          >
            {task.title}
          </span>
        </span>
      </TableCell>
      <TableCell>
        {statusName ? (
          <Badge className="bg-surface-container-high text-on-surface-variant">
            {statusName}
          </Badge>
        ) : (
          <span className="text-on-surface-variant">—</span>
        )}
      </TableCell>
      <TableCell className="text-on-surface-variant">{stageLabel ?? '—'}</TableCell>
      <TableCell>
        {assignee ? (
          <span className="inline-flex items-center gap-2">
            <AuthedAvatar
              size="sm"
              avatarDownloadUrl={assignee.user?.avatarDownloadUrl}
              avatarUrl={assignee.user?.avatarUrl}
              name={assignee.user?.name ?? assignee.userId}
            />
            <span className="text-on-surface">
              {assignee.user?.name ?? assignee.userId}
            </span>
          </span>
        ) : (
          <span className="text-on-surface-variant">—</span>
        )}
      </TableCell>
      <TableCell>
        {task.dueDate ? (
          <span className="inline-flex items-center gap-1.5">
            <span
              className={cn(
                'text-sm font-medium',
                overdue ? 'text-error' : 'text-on-surface',
              )}
            >
              {formatDueDate(task.dueDate)}
            </span>
            {overdue && (
              <span className="text-xs font-medium text-error">(vencida)</span>
            )}
            {task.deadlineLocked && (
              <Lock
                className="size-3.5 text-on-surface-variant"
                aria-label="Fecha bloqueada"
              />
            )}
          </span>
        ) : (
          <span className="text-on-surface-variant">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}
