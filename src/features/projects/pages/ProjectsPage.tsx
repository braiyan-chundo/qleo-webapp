import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Folder,
  FolderPlus,
  LayoutGrid,
  Plus,
  Search,
  Table2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  useQueryParamNumber,
  useQueryParamSearch,
  useQueryParamState,
} from '@/shared/hooks/use-query-param-state';
import { canCreateProjects } from '@/shared/lib/permissions';
import { BackButton } from '@/shared/components/BackButton';
import { useAuthStore } from '@/store/auth.store';

import { useProjects } from '../hooks/use-projects';
import { ProjectCard } from '../components/ProjectCard';
import { ProjectsTable } from '../components/ProjectsTable';
import { ProjectFormDialog } from '../components/ProjectFormDialog';
import { ArchiveProjectDialog } from '../components/ArchiveProjectDialog';
import type { Project } from '../types/project';

const PAGE_SIZE = 12;

/** Disposición de la lista de proyectos (QL-67): tarjetas o tabla (tabla = solo desktop). */
type ProjectsLayout = 'cards' | 'table';
const LAYOUT_STORAGE_KEY = 'qleo:projects-layout';

/** Lee la disposición persistida en localStorage; por defecto tarjetas. */
function readStoredLayout(): ProjectsLayout {
  if (typeof window === 'undefined') return 'cards';
  return window.localStorage.getItem(LAYOUT_STORAGE_KEY) === 'table'
    ? 'table'
    : 'cards';
}

export function ProjectsPage() {
  // QL-127: gate de creación. ADMIN siempre; MEMBER solo con el permiso otorgado. El
  // backend responde 403 PROJECT_CREATE_FORBIDDEN igualmente: esto solo evita ofrecer
  // una acción que fallaría.
  const user = useAuthStore((s) => s.user);
  const canCreate = canCreateProjects(user);

  // Filtros + paginación persistidos en la URL (params: `q`, `arch`, `page`).
  const { value: search, setValue: setSearch, committed } = useQueryParamSearch('q', 350);
  const [archivedParam, setArchivedParam] = useQueryParamState<'0' | '1'>('arch', '0');
  const archived = archivedParam === '1';
  const setArchived = (next: boolean) => setArchivedParam(next ? '1' : '0');
  const [page, setPage] = useQueryParamNumber('page', 1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Project | undefined>(undefined);
  const [archiving, setArchiving] = useState<Project | null>(null);

  // Disposición (tarjetas/tabla): estado de cliente persistido en localStorage (QL-67).
  const [layout, setLayout] = useState<ProjectsLayout>(readStoredLayout);
  useEffect(() => {
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, layout);
  }, [layout]);

  const debouncedSearch = committed;

  // Al cambiar los filtros volvemos a la primera página; omitimos el primer render para
  // respetar la `page` que venga en la URL al abrir/compartir el enlace.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setPage(1);
    // Intencionalmente reacciona solo a los filtros (no a `setPage`).
  }, [debouncedSearch, archived]);

  const params = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch.trim() || undefined,
      archived,
    }),
    [page, debouncedSearch, archived],
  );

  const { data, isLoading, isError, error, isFetching } = useProjects(params);

  const projects = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const openCreate = () => {
    // Barrera defensiva: sin permiso no hay modo alta, aunque se colara un disparador.
    if (!canCreate) return;
    setEditing(undefined);
    setFormOpen(true);
  };

  const openEdit = (project: Project) => {
    setEditing(project);
    setFormOpen(true);
  };

  return (
    <div className="p-4 md:p-8">
      {/* Encabezado */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <BackButton fallback={{ to: '/', label: 'Inicio' }} />
          <div>
            <h1 className="text-3xl font-bold text-on-surface">Proyectos</h1>
            <p className="mt-1 text-sm text-on-surface-variant">
              {canCreate
                ? 'Crea, edita y organiza tus proyectos.'
                : 'Consulta y organiza los proyectos en los que participas.'}
            </p>
          </div>
        </div>
        {canCreate && (
          <Button onClick={openCreate} className="h-10">
            <Plus />
            Nuevo proyecto
          </Button>
        )}
      </div>

      {/* Barra de filtros */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-outline" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, código o cliente…"
            className="h-10 border-outline-variant/50 bg-surface-container-low pl-9"
          />
        </div>

        <div className="flex rounded-lg bg-surface-container-low p-1">
          <button
            type="button"
            onClick={() => setArchived(false)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              !archived
                ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Activos
          </button>
          <button
            type="button"
            onClick={() => setArchived(true)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              archived
                ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Archivados
          </button>
        </div>

        {/* Disposición tarjetas/tabla (QL-67). La tabla es solo desktop → el toggle se
            oculta en móvil (`hidden md:flex`), donde siempre se muestran tarjetas. */}
        <div
          role="group"
          aria-label="Disposición de la lista"
          className="hidden rounded-lg bg-surface-container-low p-1 md:flex"
        >
          <button
            type="button"
            onClick={() => setLayout('cards')}
            aria-pressed={layout === 'cards'}
            aria-label="Ver como tarjetas"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              layout === 'cards'
                ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface',
            )}
          >
            <LayoutGrid className="size-4" />
            Tarjetas
          </button>
          <button
            type="button"
            onClick={() => setLayout('table')}
            aria-pressed={layout === 'table'}
            aria-label="Ver como tabla"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              layout === 'table'
                ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface',
            )}
          >
            <Table2 className="size-4" />
            Tabla
          </button>
        </div>
      </div>

      {/* Contenido */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-error/20 bg-error-container px-6 py-10 text-center">
          <p className="text-sm font-medium text-on-error-container">
            No se pudieron cargar los proyectos
          </p>
          <p className="mt-1 text-xs text-on-error-container/80">
            {error instanceof Error ? error.message : 'Error desconocido'}
          </p>
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant/60 bg-surface-container-low px-6 py-16 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-primary-container text-primary">
            {canCreate ? (
              <FolderPlus className="size-7" />
            ) : (
              <Folder className="size-7" />
            )}
          </div>
          <h2 className="text-lg font-semibold text-on-surface">
            {debouncedSearch
              ? 'Sin resultados'
              : archived
                ? 'No hay proyectos archivados'
                : canCreate
                  ? 'Aún no tienes proyectos'
                  : 'Aún no eres miembro de ningún proyecto'}
          </h2>
          <p className="mt-1 max-w-sm text-sm text-on-surface-variant">
            {debouncedSearch
              ? 'Prueba con otros términos de búsqueda.'
              : archived
                ? 'Los proyectos que archives aparecerán aquí.'
                : canCreate
                  ? 'Crea tu primer proyecto para empezar a trabajar.'
                  : 'Un administrador puede agregarte a un proyecto; cuando lo haga, aparecerá aquí.'}
          </p>
          {canCreate && !archived && !debouncedSearch && (
            <Button onClick={openCreate} className="mt-5 h-10">
              <Plus />
              Nuevo proyecto
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Tabla (solo desktop): en móvil se cae siempre a tarjetas. */}
          {layout === 'table' && (
            <div className="hidden md:block">
              <ProjectsTable projects={projects} />
            </div>
          )}
          <div
            className={cn(
              'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
              layout === 'table' && 'md:hidden',
            )}
          >
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onEdit={openEdit}
                onArchive={setArchiving}
              />
            ))}
          </div>

          {/* Paginación */}
          <div className="mt-8 flex items-center justify-between gap-4">
            <p className="text-sm text-on-surface-variant">
              {total} {total === 1 ? 'proyecto' : 'proyectos'} · página {page} de{' '}
              {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                disabled={page <= 1 || isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Página anterior"
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                size="icon"
                disabled={page >= totalPages || isFetching}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Página siguiente"
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Diálogos */}
      <ProjectFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        project={editing}
      />
      <ArchiveProjectDialog
        project={archiving}
        onOpenChange={(open) => {
          if (!open) setArchiving(null);
        }}
      />
    </div>
  );
}
