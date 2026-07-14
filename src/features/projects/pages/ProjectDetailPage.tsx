import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  Archive,
  ArrowLeft,
  CalendarRange,
  FileText,
  GanttChartSquare,
  Info,
  KanbanSquare,
  List,
  ListFilter,
  MoreHorizontal,
  Pencil,
  Plus,
  Settings2,
  Users,
} from 'lucide-react';

import { AvatarGroup, AvatarGroupCount } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AuthedAvatar } from '@/shared/components/AuthedAvatar';

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

import { useAuthStore } from '@/store/auth.store';

import { useProject } from '../hooks/use-projects';
import { ProjectFormDialog } from '../components/ProjectFormDialog';
import { ArchiveProjectDialog } from '../components/ArchiveProjectDialog';
import { ProjectDetailsDialog } from '../components/ProjectDetailsDialog';

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

/** Tab de vista por defecto cuando el query `?view=` está ausente o es inválido. */
const DEFAULT_VIEW: BoardView = 'kanban';
const VIEW_KEYS = VIEW_TABS.map((tab) => tab.key);

/** Máximo de avatares visibles en el grupo de miembros de la cabecera (el resto → "+N"). */
const MAX_HEADER_AVATARS = 4;

/** Type-guard: ¿el valor del query `?view=` es un `BoardView` conocido? */
function isBoardView(value: string | null): value is BoardView {
  return value !== null && (VIEW_KEYS as string[]).includes(value);
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const { data: project, isLoading, isError, error } = useProject(id);

  // Datos compartidos por las vistas del board (misma caché de Query que consumen dentro).
  // Se usan aquí para derivar opciones de filtro (responsables) y poblar el select de etapa.
  const { data: tasks } = useTasks(id);
  const { data: stages } = useStages(id);
  const filters = useTaskFilters(tasks);

  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  // Al abrir la ficha desde el avatar-group, el bloque de miembros queda a la vista.
  const [detailsFocusMembers, setDetailsFocusMembers] = useState(false);
  // El diálogo de "Configurar tablero" se gobierna aquí (igual que el de crear tarea): su
  // acción vive en la barra de la cabecera y el diálogo se renderiza dentro de `TaskBoard`.
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Pestaña de vista persistida en la URL (`?view=`, QL-72): deep-link compartible y
  // sobrevive a recargas. Valor inválido/ausente → 'kanban'. `replace: true` evita llenar
  // el history con cada cambio de tab (el back sigue volviendo al listado de proyectos).
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get('view');
  const view: BoardView = isBoardView(viewParam) ? viewParam : DEFAULT_VIEW;
  const setView = (next: BoardView) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next === DEFAULT_VIEW) params.delete('view');
        else params.set('view', next);
        return params;
      },
      { replace: true },
    );
  };

  const openDetails = (focusMembers: boolean) => {
    setDetailsFocusMembers(focusMembers);
    setDetailsOpen(true);
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-8">
        <Skeleton className="mb-2 h-10 w-2/3" />
        <Skeleton className="mb-6 h-4 w-1/2" />
        <Skeleton className="mb-4 h-10 w-full" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
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

  const canManage =
    !!user && (user.role === 'ADMIN' || project.createdBy === user.id);

  const dotClass = projectDot(project.color);
  // Membresía real del detalle (QL-51): se muestran hasta 4 avatares y el resto como "+N".
  const shownMembers = project.members.slice(0, MAX_HEADER_AVATARS);
  const extraMembers = project.memberCount - shownMembers.length;
  const membersLabel =
    project.memberCount === 1 ? '1 miembro' : `${project.memberCount} miembros`;

  return (
    <div
      className={cn(
        'p-4 md:p-8',
        // QL-36 (desktop): en Kanban la página se vuelve una columna flex acotada al alto del
        // <main> (sin número mágico): cabecera + tabs toman su alto natural y el board rellena
        // el espacio restante, scrollando solo por dentro. Así desktop no genera scroll vertical
        // de página. El resto de vistas (List/Gantt/Planner/Documentos) conserva el flujo normal
        // con scroll de página, y en < md se mantiene el comportamiento móvil.
        view === 'kanban' &&
          'md:flex md:h-full md:min-h-0 md:flex-col md:overflow-hidden',
      )}
    >
      {/* Cabecera compacta (board-first): una fila de identidad + acciones y una línea de
          descripción. Los metadatos y la membresía viven en el modal de detalles. */}
      <header className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                asChild
                variant="ghost"
                size="icon-lg"
                className="shrink-0 text-on-surface-variant hover:text-on-surface"
              >
                <Link to="/projects" aria-label="Volver a proyectos">
                  <ArrowLeft className="size-5" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Volver a proyectos</TooltipContent>
          </Tooltip>

          {dotClass && (
            <span
              aria-hidden
              className={cn('size-3 shrink-0 rounded-full', dotClass)}
            />
          )}
          <h1 className="min-w-0 truncate text-2xl font-bold text-on-surface md:text-3xl">
            {project.name}
          </h1>

          {project.code && (
            <span className="shrink-0 rounded-md bg-surface-container-high px-1.5 py-0.5 text-xs font-semibold tracking-wide text-on-surface-variant uppercase">
              #{project.code}
            </span>
          )}
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
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

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {/* Miembros del proyecto (QL-51): atajo visual a la ficha, con foco en miembros. */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => openDetails(true)}
                aria-label={`Miembros del proyecto (${membersLabel})`}
                className="mr-1 flex items-center rounded-full p-0.5 transition-colors hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {shownMembers.length > 0 ? (
                  <AvatarGroup>
                    {shownMembers.map((m) => (
                      <AuthedAvatar
                        key={m.id}
                        size="sm"
                        avatarDownloadUrl={m.avatarDownloadUrl}
                        name={m.name}
                      />
                    ))}
                    {extraMembers > 0 && (
                      <AvatarGroupCount>+{extraMembers}</AvatarGroupCount>
                    )}
                  </AvatarGroup>
                ) : (
                  <span className="flex size-6 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant">
                    <Users className="size-3.5" />
                  </span>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>{membersLabel} · Ver detalles</TooltipContent>
          </Tooltip>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" aria-label="Filtrar">
                <ListFilter />
                <span className="hidden sm:inline">Filtrar</span>
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

          {/* Configurar tablero: acción primaria del Kanban (antes escondida en una fila
              propia del board y en el `···` de cada columna). Solo aplica a esta vista. */}
          {view === 'kanban' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  onClick={() => setSettingsOpen(true)}
                  aria-label="Configurar tablero"
                >
                  <Settings2 />
                  <span className="hidden sm:inline">Configurar tablero</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent className="sm:hidden">
                Configurar tablero
              </TooltipContent>
            </Tooltip>
          )}

          <Button
            onClick={() => setCreateTaskOpen(true)}
            aria-label="Nueva tarea"
          >
            <Plus />
            <span className="hidden sm:inline">Nueva tarea</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-outline-variant text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              aria-label="Más acciones del proyecto"
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => openDetails(false)}>
                <Info className="size-4" />
                Detalles del proyecto
              </DropdownMenuItem>
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

        {project.description && (
          <p
            title={project.description}
            className="w-full min-w-0 truncate text-sm text-on-surface-variant"
          >
            {project.description}
          </p>
        )}
      </header>

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
          settingsOpen={settingsOpen}
          onSettingsOpenChange={setSettingsOpen}
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
        <PlannerView
          projectId={project.id}
          filterTasks={filters.filter}
          project={project}
        />
      )}
      {view === 'documents' && <ProjectDocumentsPanel project={project} />}

      <ProjectDetailsDialog
        project={project}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        canManage={canManage}
        focusMembers={detailsFocusMembers}
      />
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
