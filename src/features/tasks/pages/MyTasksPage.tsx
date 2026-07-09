import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, ChevronRight, ListChecks, Lock, Search } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { cn } from '@/lib/utils';

import { useProjects } from '@/features/projects/hooks/use-projects';
import type { Project } from '@/features/projects/types/project';
import {
  useQueryParamSearch,
  useQueryParamState,
} from '@/shared/hooks/use-query-param-state';

import { useMyTasks } from '../hooks/use-tasks';
import type { Task, TaskRole } from '../services/tasks.service';
import { projectDot } from '../lib/palette';
import { TASK_ROLE_BADGE_CLASS, TASK_ROLE_LABEL } from '../lib/roles';
import { formatDueDate, isDueToday, isOverdue } from '../lib/deadline';

/** Valor sentinela para "todos los roles" en el select (los roles reales nunca son vacíos). */
const ALL_ROLES = '';

/** Filtro por estado de cierre de la tarea. */
type StatusFilter = 'all' | 'pending' | 'completed';

/**
 * Modo de orden de la lista (QL-73, estado de cliente):
 * - `deadline`: lista PLANA por fecha límite asc (vencidas → próximas → sin fecha), tal cual
 *   la entrega `GET /tasks/mine`; hace visible el "más próximo primero" global.
 * - `project`: agrupada por proyecto (el comportamiento histórico de la pantalla).
 */
type SortMode = 'deadline' | 'project';

/** Un grupo de tareas del usuario pertenecientes a un mismo proyecto. */
interface ProjectGroup {
  projectId: string;
  project: Project | undefined;
  tasks: Task[];
}

/**
 * Pantalla "Mis tareas" (§3.7): todas las tareas donde el usuario del token participa,
 * agrupadas por proyecto. El dato del servidor vive en la caché de TanStack Query
 * (`useMyTasks`, `useProjects`); los filtros son estado de cliente y se aplican en memoria.
 * Al ser cross-proyecto, un click en una tarea navega directo a su vista dedicada
 * `/projects/:id/tasks/:taskId` (QL-25) en lugar de abrir el modal de vistazo.
 */
export function MyTasksPage() {
  const navigate = useNavigate();
  const { data: tasks, isLoading, isError, error } = useMyTasks();
  // Trae los proyectos para resolver nombre/código por `projectId` (el endpoint de
  // tareas solo trae `projectId`). `limit: 50` es el máximo que admite `GET /projects`.
  const { data: projectsPage } = useProjects({ page: 1, limit: 50 });

  // Filtros persistidos en la URL (params: `q`, `rol`, `estado`).
  const { value: search, setValue: setSearch, committed } = useQueryParamSearch('q', 300);
  const [roleFilter, setRoleFilter] = useQueryParamState<TaskRole | ''>('rol', ALL_ROLES);
  const [statusFilter, setStatusFilter] = useQueryParamState<StatusFilter>('estado', 'all');
  const debouncedSearch = committed.toLowerCase();

  // Orden de la lista: estado de cliente puro (QL-73), no filtra datos del servidor.
  const [sortMode, setSortMode] = useState<SortMode>('deadline');

  const projectById = useMemo(() => {
    const map = new Map<string, Project>();
    projectsPage?.data.forEach((p) => map.set(p.id, p));
    return map;
  }, [projectsPage]);

  // Filtro combinado (AND). No reordena: `/tasks/mine` ya viene por `dueDate` asc.
  const filtered = useMemo(() => {
    return (tasks ?? []).filter((task) => {
      if (debouncedSearch && !task.title.toLowerCase().includes(debouncedSearch)) {
        return false;
      }
      if (roleFilter && task.currentUserRole !== roleFilter) return false;
      if (statusFilter === 'pending' && task.isCompleted) return false;
      if (statusFilter === 'completed' && !task.isCompleted) return false;
      return true;
    });
  }, [tasks, debouncedSearch, roleFilter, statusFilter]);

  // Agrupa por proyecto conservando el orden de aparición (mantiene el `dueDate` asc global).
  const groups = useMemo<ProjectGroup[]>(() => {
    const order: string[] = [];
    const byProject = new Map<string, Task[]>();
    for (const task of filtered) {
      const bucket = byProject.get(task.projectId);
      if (bucket) {
        bucket.push(task);
      } else {
        byProject.set(task.projectId, [task]);
        order.push(task.projectId);
      }
    }
    return order.map((projectId) => ({
      projectId,
      project: projectById.get(projectId),
      tasks: byProject.get(projectId) ?? [],
    }));
  }, [filtered, projectById]);

  const hasFilters = !!debouncedSearch || !!roleFilter || statusFilter !== 'all';

  return (
    <div className="p-4 md:p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-on-surface">Mis tareas</h1>
        <p className="mt-1 text-on-surface-variant">
          Todas las tareas en las que participas. Ordénalas por fecha límite (más próximas
          primero) o agrúpalas por proyecto.
        </p>
      </header>

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
          <span className="text-xs font-medium text-on-surface-variant">Mi rol</span>
          <NativeSelect
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as TaskRole | '')}
            aria-label="Filtrar por mi rol"
          >
            <NativeSelectOption value={ALL_ROLES}>Todos</NativeSelectOption>
            <NativeSelectOption value="CREATOR">Creador</NativeSelectOption>
            <NativeSelectOption value="ASSIGNEE">Responsable</NativeSelectOption>
            <NativeSelectOption value="COLLABORATOR">Colaborador</NativeSelectOption>
            <NativeSelectOption value="OBSERVER">Observador</NativeSelectOption>
          </NativeSelect>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-on-surface-variant">Estado</span>
          <NativeSelect
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            aria-label="Filtrar por estado de cierre"
          >
            <NativeSelectOption value="all">Todas</NativeSelectOption>
            <NativeSelectOption value="pending">Pendientes</NativeSelectOption>
            <NativeSelectOption value="completed">Completadas</NativeSelectOption>
          </NativeSelect>
        </label>

        {/* Orden de la lista (QL-73): por vencimiento (plana) o por proyecto (agrupada). */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-on-surface-variant">Ordenar</span>
          <div
            role="group"
            aria-label="Ordenar tareas"
            className="flex h-10 items-center rounded-lg bg-surface-container-low p-1"
          >
            <SortButton
              active={sortMode === 'deadline'}
              onClick={() => setSortMode('deadline')}
            >
              Por vencimiento
            </SortButton>
            <SortButton
              active={sortMode === 'project'}
              onClick={() => setSortMode('project')}
            >
              Por proyecto
            </SortButton>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-6 w-40 rounded-lg" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-error/20 bg-error-container px-4 py-3 text-sm font-medium text-on-error-container">
          {error instanceof Error ? error.message : 'No se pudieron cargar tus tareas'}
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm text-on-surface-variant">
            {filtered.length} {filtered.length === 1 ? 'tarea' : 'tareas'}
          </p>

          {filtered.length === 0 ? (
            <EmptyState hasFilters={hasFilters} />
          ) : sortMode === 'deadline' ? (
            // Lista plana: conserva el orden `dueDate` asc global (vencidas → próximas → sin fecha).
            <ul className="overflow-hidden rounded-lg border border-outline-variant/40 divide-y divide-outline-variant/30">
              {filtered.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  project={projectById.get(task.projectId)}
                  emphasize
                  onOpen={() =>
                    navigate(`/projects/${task.projectId}/tasks/${task.id}`)
                  }
                />
              ))}
            </ul>
          ) : (
            <div className="space-y-6">
              {groups.map((group) => (
                <ProjectSection
                  key={group.projectId}
                  group={group}
                  onOpen={(task) =>
                    navigate(`/projects/${task.projectId}/tasks/${task.id}`)
                  }
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface SortButtonProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}

/** Botón segmentado del control de orden (QL-73), mismo look que el toggle de Proyectos. */
function SortButton({ active, onClick, children }: SortButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'bg-surface-container-lowest text-on-surface shadow-sm'
          : 'text-on-surface-variant hover:text-on-surface',
      )}
    >
      {children}
    </button>
  );
}

interface EmptyStateProps {
  hasFilters: boolean;
}

/** Estado vacío: distingue "sin tareas" de "ningún resultado con los filtros". */
function EmptyState({ hasFilters }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-outline-variant/60 px-4 py-12 text-center">
      <ListChecks className="size-8 text-on-surface-variant" />
      <p className="text-sm text-on-surface-variant">
        {hasFilters
          ? 'Ninguna tarea coincide con los filtros.'
          : 'No participas en ninguna tarea todavía.'}
      </p>
    </div>
  );
}

interface ProjectSectionProps {
  group: ProjectGroup;
  onOpen: (task: Task) => void;
}

/** Encabezado del proyecto (enlazable) + sus tareas. */
function ProjectSection({ group, onOpen }: ProjectSectionProps) {
  const { project, projectId, tasks } = group;
  const title = project?.name ?? 'Proyecto';
  const dotClass = projectDot(project?.color);

  return (
    <section>
      <div className="mb-2 flex items-baseline gap-2">
        {dotClass && (
          <span
            aria-hidden
            className={cn('size-2.5 shrink-0 self-center rounded-full', dotClass)}
          />
        )}
        <Link
          to={`/projects/${projectId}`}
          className="text-lg font-semibold text-on-surface transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {title}
        </Link>
        {project?.code && (
          <span className="text-sm font-medium text-on-surface-variant">
            {project.code}
          </span>
        )}
        <span className="text-sm text-on-surface-variant">
          · {tasks.length} {tasks.length === 1 ? 'tarea' : 'tareas'}
        </span>
      </div>

      <ul className="overflow-hidden rounded-lg border border-outline-variant/40 divide-y divide-outline-variant/30">
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} onOpen={() => onOpen(task)} />
        ))}
      </ul>
    </section>
  );
}

interface TaskRowProps {
  task: Task;
  onOpen: () => void;
  /** En modo "Por vencimiento" (lista plana) se muestra a qué proyecto pertenece la tarea. */
  project?: Project;
  /** Resalta vencidas (acento error) y próximas/hoy (acento primario) con un borde lateral. */
  emphasize?: boolean;
}

/** Fila de tarea: título + estado de cierre, mi rol y fecha límite. Click abre el detalle. */
function TaskRow({ task, onOpen, project, emphasize }: TaskRowProps) {
  const overdue = isOverdue(task.dueDate) && !task.isCompleted;
  const dueToday = !overdue && !task.isCompleted && isDueToday(task.dueDate);
  const dotClass = projectDot(project?.color);

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Abrir tarea ${task.title}`}
        className={cn(
          'flex w-full items-center gap-3 bg-surface-container-lowest px-4 py-3 text-left transition-colors hover:bg-surface-container-low focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
          emphasize && overdue && 'border-l-2 border-l-error',
          emphasize && dueToday && 'border-l-2 border-l-primary',
        )}
      >
        <div className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            {task.isCompleted && (
              <CheckCircle2
                className="size-4 shrink-0 text-tertiary"
                aria-label="Completada"
              />
            )}
            <span
              className={cn(
                'truncate font-medium text-on-surface',
                task.isCompleted && 'text-on-surface-variant line-through',
              )}
            >
              {task.title}
            </span>
          </span>
          {project && (
            <span className="mt-0.5 flex items-center gap-1.5 text-xs text-on-surface-variant">
              {dotClass && (
                <span
                  aria-hidden
                  className={cn('size-2 shrink-0 rounded-full', dotClass)}
                />
              )}
              <span className="truncate">{project.name}</span>
              {project.code && <span className="shrink-0">· {project.code}</span>}
            </span>
          )}
        </div>

        {task.currentUserRole && (
          <Badge className={cn('shrink-0', TASK_ROLE_BADGE_CLASS[task.currentUserRole])}>
            {TASK_ROLE_LABEL[task.currentUserRole]}
          </Badge>
        )}

        <div className="flex w-40 shrink-0 items-center justify-end gap-1.5">
          {task.dueDate ? (
            <>
              <span
                className={cn(
                  'text-sm font-medium',
                  overdue
                    ? 'text-error'
                    : dueToday
                      ? 'text-primary'
                      : 'text-on-surface',
                )}
              >
                {formatDueDate(task.dueDate)}
              </span>
              {overdue && (
                <span className="text-xs font-medium text-error">(vencida)</span>
              )}
              {dueToday && (
                <span className="text-xs font-medium text-primary">(hoy)</span>
              )}
              {task.deadlineLocked && (
                <Lock
                  className="size-3.5 text-on-surface-variant"
                  aria-label="Fecha bloqueada"
                />
              )}
            </>
          ) : (
            <span className="text-sm text-on-surface-variant">Sin fecha</span>
          )}
        </div>

        <ChevronRight className="size-4 shrink-0 text-on-surface-variant" />
      </button>
    </li>
  );
}
