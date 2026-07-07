import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Archive,
  ArrowLeft,
  CalendarRange,
  ChevronDown,
  FileText,
  GanttChartSquare,
  KanbanSquare,
  List,
  ListFilter,
  MoreHorizontal,
  Pencil,
  Plus,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

import { TaskBoard } from '@/features/tasks/components/TaskBoard';
import { TaskListView } from '@/features/tasks/components/TaskListView';
import { GanttView } from '@/features/tasks/components/GanttView';
import { PlannerView } from '@/features/tasks/components/PlannerView';
import { ProjectDocumentsPanel } from '@/features/attachments/components/ProjectDocumentsPanel';
import { BoardFilterPanel } from '@/features/tasks/components/BoardFilterPanel';
import { useTasks } from '@/features/tasks/hooks/use-tasks';
import { useTaskFilters } from '@/features/tasks/hooks/use-task-filters';
import { useStages } from '@/features/stages/hooks/use-stages';
import { projectDot } from '@/features/tasks/lib/palette';

import { useProject } from '../hooks/use-projects';
import { ProjectFormDialog } from '../components/ProjectFormDialog';
import { ArchiveProjectDialog } from '../components/ArchiveProjectDialog';
import { formatDate } from '../utils/dates';

type BoardView = 'kanban' | 'list' | 'gantt' | 'planner' | 'documents';

interface ViewTab {
  key: BoardView;
  label: string;
  icon: React.ReactNode;
}

const VIEW_TABS: ViewTab[] = [
  { key: 'kanban', label: 'Kanban', icon: <KanbanSquare className="size-4" /> },
  { key: 'list', label: 'List', icon: <List className="size-4" /> },
  { key: 'gantt', label: 'Gantt', icon: <GanttChartSquare className="size-4" /> },
  { key: 'planner', label: 'Planner', icon: <CalendarRange className="size-4" /> },
  { key: 'documents', label: 'Documentos', icon: <FileText className="size-4" /> },
];

interface MetaFieldProps {
  label: string;
  value?: string;
}

function MetaField({ label, value }: MetaFieldProps) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-on-surface-variant">{label}</p>
      <p className="truncate text-sm font-medium text-on-surface">
        {value || '—'}
      </p>
    </div>
  );
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: project, isLoading, isError, error } = useProject(id);

  // Datos compartidos por las vistas del board (misma caché de Query que consumen dentro).
  // Se usan aquí para derivar opciones de filtro (responsables) y poblar el select de etapa.
  const { data: tasks } = useTasks(id);
  const { data: stages } = useStages(id);
  const filters = useTaskFilters(tasks);

  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [view, setView] = useState<BoardView>('kanban');
  const [detailsOpen, setDetailsOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="p-4 md:p-8">
        <Skeleton className="mb-4 h-6 w-32" />
        <Skeleton className="mb-2 h-10 w-2/3" />
        <Skeleton className="mb-8 h-4 w-1/2" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="p-4 md:p-8">
        <Link
          to="/projects"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-on-surface-variant hover:text-on-surface"
        >
          <ArrowLeft className="size-4" />
          Volver a proyectos
        </Link>
        <div className="rounded-xl border border-error/20 bg-error-container px-6 py-10 text-center">
          <p className="text-sm font-medium text-on-error-container">
            No se pudo cargar el proyecto
          </p>
          <p className="mt-1 text-xs text-on-error-container/80">
            {error instanceof Error ? error.message : 'Proyecto no encontrado'}
          </p>
        </div>
      </div>
    );
  }

  const dateRange =
    project.startDate || project.endDate
      ? `${formatDate(project.startDate) || '—'} → ${formatDate(project.endDate) || '—'}`
      : undefined;

  return (
    <div className="p-4 md:p-8">
      <Link
        to="/projects"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-on-surface-variant hover:text-on-surface"
      >
        <ArrowLeft className="size-4" />
        Volver a proyectos
      </Link>

      {/* Encabezado board-first */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            {project.code && (
              <span className="text-xs font-semibold tracking-wide text-on-surface-variant uppercase">
                Proyecto #{project.code}
              </span>
            )}
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                project.archived
                  ? 'bg-surface-container-high text-on-surface-variant'
                  : 'bg-tertiary-container text-on-tertiary-container',
              )}
            >
              {project.archived ? (
                <>
                  <Archive className="size-3" />
                  Archivado
                </>
              ) : (
                'Activo'
              )}
            </span>
          </div>
          <h1 className="flex items-center gap-2.5 text-3xl font-bold text-on-surface">
            {projectDot(project.color) && (
              <span
                aria-hidden
                className={cn(
                  'size-3.5 shrink-0 rounded-full',
                  projectDot(project.color),
                )}
              />
            )}
            {project.name}
          </h1>
          {project.description && (
            <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">
              {project.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <ListFilter />
                Filtrar
                {filters.activeCount > 0 && (
                  <Badge className="ml-1 h-5 min-w-5 justify-center rounded-full bg-primary px-1.5 text-on-primary tabular-nums">
                    {filters.activeCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72">
              <BoardFilterPanel filters={filters} stages={stages} />
            </PopoverContent>
          </Popover>

          <Button onClick={() => setCreateTaskOpen(true)}>
            <Plus />
            Nueva tarea
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-outline-variant text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              aria-label="Más acciones del proyecto"
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                <Pencil className="size-4" />
                Editar proyecto
              </DropdownMenuItem>
              {!project.archived && (
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => setArchiveOpen(true)}
                >
                  <Archive className="size-4" />
                  Archivar proyecto
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Detalles del expediente (colapsable, no domina la vista) */}
      <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen} className="mb-4">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs font-medium text-on-surface-variant hover:text-on-surface"
          >
            <ChevronDown
              className={cn(
                'size-3.5 transition-transform',
                detailsOpen && 'rotate-180',
              )}
            />
            Detalles del expediente
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-3 grid gap-4 rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetaField label="Cliente / grupo" value={project.clientGroup} />
            <MetaField label="Destino" value={project.destination} />
            <MetaField label="Fechas del viaje" value={dateRange} />
            <MetaField label="Creado" value={formatDate(project.createdAt)} />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Barra de tabs de vista (estilo underline) */}
      <div className="border-b border-outline-variant/60">
        <div className="flex flex-wrap gap-1">
          {VIEW_TABS.map((tab) => {
            const active = view === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setView(tab.key)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'border-primary text-primary'
                    : 'border-transparent text-on-surface-variant hover:text-on-surface',
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {view === 'kanban' && (
        <TaskBoard
          projectId={project.id}
          createOpen={createTaskOpen}
          onCreateOpenChange={setCreateTaskOpen}
          filterTasks={filters.filter}
        />
      )}
      {view === 'list' && (
        <div className="mt-4">
          {/* List conserva sus propios filtros (columna, orden, export CSV): es la vista
              dedicada a filtrar, así evitamos duplicar controles con el popover del board. */}
          <TaskListView projectId={project.id} projectCode={project.code} />
        </div>
      )}
      {view === 'gantt' && (
        <GanttView projectId={project.id} filterTasks={filters.filter} />
      )}
      {view === 'planner' && (
        <PlannerView projectId={project.id} filterTasks={filters.filter} />
      )}
      {view === 'documents' && <ProjectDocumentsPanel project={project} />}

      <ProjectFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        project={project}
      />
      <ArchiveProjectDialog
        project={archiveOpen ? project : null}
        onOpenChange={(open) => {
          if (!open) setArchiveOpen(false);
        }}
      />
    </div>
  );
}
