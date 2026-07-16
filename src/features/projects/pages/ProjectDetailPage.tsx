import { useCallback, useState } from 'react';
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
import { projectDot } from '@/features/tasks/lib/palette';

import { useAuthStore } from '@/store/auth.store';

import { useProject } from '../hooks/use-projects';
import { canManageProject, canManageMembership } from '../utils/permissions';
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
  // Se usan aquí para derivar las opciones de filtro (responsables).
  const { data: tasks } = useTasks(id);
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

  /**
   * Ref-callback del tab activo (QL-123): la fila de tabs hace scroll horizontal en móvil, así
   * que al montar (deep-link `?view=gantt`) o al cambiar de vista dejamos el tab activo a la
   * vista. `block: 'nearest'` evita cualquier salto vertical de la página; solo ajusta el eje
   * que hace falta. React invoca el callback cuando el nodo activo cambia de tab.
   */
  const scrollActiveTabIntoView = useCallback((node: HTMLButtonElement | null) => {
    node?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, []);

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

  // (P2/§3.20) Dos niveles de permiso sobre el proyecto (reglas en `projects/utils/permissions`,
  // fuente única compartida con los consumidores — p. ej. `BoardSettingsDialog`):
  // - `canManageProject`: editar/archivar/configurar tablero → ADMIN, creador o manager.
  // - `canManageMembership`: gestionar miembros y otorgar/revocar managers → ADMIN o creador.
  const canManage = canManageProject(project, user);
  const canManageMembers = canManageMembership(project, user);

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
        {/* QL-123 (solo móvil): la fila de identidad puede envolver, de modo que el par de chips
            (código/estado) baja bajo el título en vez de robarle el ancho. En `sm+` se fuerza
            `flex-nowrap` → la cabecera queda exactamente como está hoy. */}
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:flex-nowrap">
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
          {/* `grow basis-32` en móvil: el título reclama la primera línea entera (y con ella
              empuja los chips a la siguiente); en `sm+` vuelve a `basis-auto`/`grow-0`, es decir,
              al reparto de hoy (si creciera en desktop, separaría los chips del título). */}
          <h1 className="min-w-0 grow basis-32 truncate text-2xl font-bold text-on-surface sm:grow-0 sm:basis-auto md:text-3xl">
            {project.name}
          </h1>

          {/* QL-123: en móvil los chips se **apilan** (código encima de estado) en vez de ir en
              línea, para devolverle ancho al nombre del proyecto, que quedaba sin espacio. En
              `sm+` vuelven a la fila de siempre (el `gap-2` del padre separa el título del par y
              el `sm:gap-2` de aquí separa los dos chips → mismo resultado que antes). */}
          <div className="flex shrink-0 flex-col items-start gap-0.5 sm:flex-row sm:items-center sm:gap-2">
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
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {/* Miembros del proyecto (QL-51): atajo visual a la ficha, con foco en miembros.
              QL-123: oculto en móvil (`hidden sm:flex`) — se comía el ancho del nombre del
              proyecto. No se pierde acceso: `···` → "Detalles del proyecto" abre la misma ficha,
              que siempre renderiza el bloque de miembros. */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => openDetails(true)}
                aria-label={`Miembros del proyecto (${membersLabel})`}
                className="mr-1 hidden items-center rounded-full p-0.5 transition-colors hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:flex"
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
              <BoardFilterPanel filters={filters} />
            </PopoverContent>
          </Popover>

          {/* Configurar tablero: acción primaria del Kanban (antes escondida en una fila
              propia del board y en el `···` de cada columna). Solo aplica a esta vista y a
              quien puede gestionar el proyecto (§3.20). */}
          {view === 'kanban' && canManage && (
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
              {/* Editar/archivar: solo ADMIN, creador o manager (§3.20). Un miembro normal
                  no ve estas acciones (sí puede crear tareas). */}
              {canManage && (
                <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                  <Pencil className="size-4" />
                  Editar proyecto
                </DropdownMenuItem>
              )}
              {canManage && !project.archived && (
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

      {/* Barra de tabs de vista (estilo underline). QL-123: en móvil los tabs ya no se envuelven
          a una segunda línea; la fila hace **scroll horizontal** (`flex-nowrap` + `overflow-x-auto`,
          con la barra oculta vía la utilidad `no-scrollbar` que ya trae el proyecto). El tab activo
          se lleva a la vista al montar y al cambiar de vista (deep-link `?view=`), y el foco por
          teclado lo arrastra el propio navegador dentro del contenedor scrollable. */}
      <div className="border-b border-outline-variant/60">
        <div className="no-scrollbar flex flex-nowrap gap-1 overflow-x-auto">
          {VIEW_TABS.map((tab) => {
            const active = view === tab.key;
            return (
              <button
                key={tab.key}
                ref={active ? scrollActiveTabIntoView : undefined}
                type="button"
                onClick={() => setView(tab.key)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
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
        canManage={canManageMembers}
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
