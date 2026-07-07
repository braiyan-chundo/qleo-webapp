import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderKanban, ListChecks, Search } from 'lucide-react';

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Kbd } from '@/components/ui/kbd';
import { Spinner } from '@/components/ui/spinner';

import { SEARCH_MIN_CHARS, useGlobalSearch } from '../hooks/use-search';

/**
 * Buscador global de la topbar (QL-28, §3.16). Command palette accesible desde un botón de
 * la topbar y con el atajo ⌘K / Ctrl+K. Muestra dos secciones (Proyectos / Tareas). Al
 * seleccionar: proyecto → `/projects/:id`; tarea → `/projects/:projectId/tasks/:taskId`
 * (la vista dedicada de la tarea, QL-25). El dato vive en TanStack Query
 * (`useGlobalSearch`, con debounce y umbral de 2 caracteres).
 *
 * `cmdk` filtra por defecto sobre el texto de los ítems; aquí desactivamos ese filtro
 * (`shouldFilter={false}`) porque el filtrado real lo hace el backend por el término.
 *
 * `variant` controla el disparador (QL-33): `bar` es la píldora ancha (desktop, `md+`);
 * `icon` es solo un botón de lupa (móvil), que evita que el placeholder se parta en
 * varias líneas. Ambos abren el mismo command dialog (y comparten el atajo ⌘K).
 */
interface GlobalSearchProps {
  variant?: 'bar' | 'icon';
}

export function GlobalSearch({ variant = 'bar' }: GlobalSearchProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');

  const { results, isLoading, isError, enabled, term: activeTerm } =
    useGlobalSearch(term);

  // Atajo global ⌘K / Ctrl+K para abrir el buscador.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // Limpia el término al cerrar para que la próxima apertura empiece en blanco.
  useEffect(() => {
    if (!open) setTerm('');
  }, [open]);

  const goToProject = useCallback(
    (projectId: string) => {
      setOpen(false);
      navigate(`/projects/${projectId}`);
    },
    [navigate],
  );

  const goToTask = useCallback(
    (projectId: string, taskId: string) => {
      setOpen(false);
      navigate(`/projects/${projectId}/tasks/${taskId}`);
    },
    [navigate],
  );

  const projects = results?.projects ?? [];
  const tasks = results?.tasks ?? [];
  const hasResults = projects.length > 0 || tasks.length > 0;
  const belowThreshold = !enabled;

  return (
    <>
      {/* Disparador — se integra en la topbar en lugar del input estático anterior. */}
      {variant === 'icon' ? (
        // Móvil (QL-33): solo un icono de lupa; el placeholder ancho se partía en varias
        // líneas. Abre el mismo command dialog que la barra.
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Buscar (Ctrl+K)"
          className="flex size-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        >
          <Search className="size-5 shrink-0" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Buscar (Ctrl+K)"
          className="group flex h-10 w-full max-w-md items-center gap-2 rounded-lg border border-outline-variant/50 bg-surface-container-low px-3 text-sm text-on-surface-variant transition-colors hover:border-primary/60 hover:bg-surface focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        >
          <Search className="size-4 shrink-0 text-outline" />
          <span className="flex-1 text-left">Buscar expedientes y tareas…</span>
          <Kbd className="hidden sm:inline-flex">⌘K</Kbd>
        </button>
      )}

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Buscador global"
        description="Busca proyectos y tareas en las que participas."
        className="sm:max-w-lg"
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={term}
            onValueChange={setTerm}
            placeholder="Buscar expedientes y tareas…"
          />
          <CommandList>
          {belowThreshold ? (
            <p className="px-4 py-6 text-center text-sm text-on-surface-variant">
              Escribe al menos {SEARCH_MIN_CHARS} caracteres para buscar.
            </p>
          ) : isLoading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-on-surface-variant">
              <Spinner className="size-4" />
              Buscando…
            </div>
          ) : isError ? (
            <p className="px-4 py-6 text-center text-sm text-error">
              No se pudo completar la búsqueda.
            </p>
          ) : !hasResults ? (
            <CommandEmpty className="text-on-surface-variant">
              Sin resultados para «{activeTerm}».
            </CommandEmpty>
          ) : (
            <>
              {projects.length > 0 && (
                <CommandGroup heading="Proyectos">
                  {projects.map((project) => (
                    <CommandItem
                      key={project.id}
                      value={`project-${project.id}`}
                      onSelect={() => goToProject(project.id)}
                      className="cursor-pointer"
                    >
                      <FolderKanban className="text-on-surface-variant" />
                      <span className="min-w-0 flex-1 truncate text-on-surface">
                        {project.name}
                      </span>
                      {project.code && (
                        <span className="shrink-0 text-xs font-medium text-on-surface-variant">
                          {project.code}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {tasks.length > 0 && (
                <CommandGroup heading="Tareas">
                  {tasks.map((task) => (
                    <CommandItem
                      key={task.id}
                      value={`task-${task.id}`}
                      onSelect={() => goToTask(task.projectId, task.id)}
                      className="cursor-pointer"
                    >
                      <ListChecks className="text-on-surface-variant" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-on-surface">
                          {task.title}
                        </span>
                        <span className="truncate text-xs text-on-surface-variant">
                          {task.projectName}
                        </span>
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </>
          )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
