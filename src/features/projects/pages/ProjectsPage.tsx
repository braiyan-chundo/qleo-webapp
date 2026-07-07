import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  FolderPlus,
  Plus,
  Search,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useQueryParamNumber,
  useQueryParamSearch,
  useQueryParamState,
} from '@/shared/hooks/use-query-param-state';

import { useProjects } from '../hooks/use-projects';
import { ProjectCard } from '../components/ProjectCard';
import { ProjectFormDialog } from '../components/ProjectFormDialog';
import { ArchiveProjectDialog } from '../components/ArchiveProjectDialog';
import type { Project } from '../types/project';

const PAGE_SIZE = 12;

export function ProjectsPage() {
  // Filtros + paginación persistidos en la URL (params: `q`, `arch`, `page`).
  const { value: search, setValue: setSearch, committed } = useQueryParamSearch('q', 350);
  const [archivedParam, setArchivedParam] = useQueryParamState<'0' | '1'>('arch', '0');
  const archived = archivedParam === '1';
  const setArchived = (next: boolean) => setArchivedParam(next ? '1' : '0');
  const [page, setPage] = useQueryParamNumber('page', 1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Project | undefined>(undefined);
  const [archiving, setArchiving] = useState<Project | null>(null);

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
        <div>
          <h1 className="text-3xl font-bold text-on-surface">Proyectos</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Expedientes de viaje. Crea, edita y organiza tus proyectos.
          </p>
        </div>
        <Button onClick={openCreate} className="h-10">
          <Plus />
          Nuevo proyecto
        </Button>
      </div>

      {/* Barra de filtros */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-outline" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, código, cliente o destino…"
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
            <FolderPlus className="size-7" />
          </div>
          <h2 className="text-lg font-semibold text-on-surface">
            {debouncedSearch
              ? 'Sin resultados'
              : archived
                ? 'No hay proyectos archivados'
                : 'Aún no tienes proyectos'}
          </h2>
          <p className="mt-1 max-w-sm text-sm text-on-surface-variant">
            {debouncedSearch
              ? 'Prueba con otros términos de búsqueda.'
              : archived
                ? 'Los proyectos que archives aparecerán aquí.'
                : 'Crea tu primer expediente de viaje para empezar a trabajar.'}
          </p>
          {!archived && !debouncedSearch && (
            <Button onClick={openCreate} className="mt-5 h-10">
              <Plus />
              Nuevo proyecto
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
