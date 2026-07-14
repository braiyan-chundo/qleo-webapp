import { Link } from 'react-router-dom';
import { ChevronRight, Clock, FolderOpen } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { projectDot } from '@/features/tasks/lib/palette';
import { useProjects } from '@/features/projects/hooks/use-projects';
import { useRecentProjects } from '@/features/projects/store/recent-projects.store';
import type { ProjectColor } from '@/features/projects/types/project';
import type { ProjectListParams } from '@/features/projects/services/projects.service';
import { useAuthStore } from '@/store/auth.store';

/** Fila pintable, común al historial de visitas y al fallback del listado. */
interface RecentProjectItem {
  id: string;
  name: string;
  code: string | null;
  color: ProjectColor | null;
}

/** Fallback: los últimos proyectos activos del listado, si aún no hay historial de visitas. */
const FALLBACK_PARAMS: ProjectListParams = { archived: false, limit: 6 };

/**
 * "Proyectos recientes" del Inicio: acceso directo a los proyectos que el usuario **visitó
 * hace poco** (historial de cliente, `recent-projects.store`), como el "Recent" de Jira.
 *
 * En un dispositivo nuevo el historial está vacío, así que cae a los últimos proyectos activos
 * del usuario (`useProjects`, TanStack Query) para no mostrar nunca un hueco. Ese fallback solo
 * pide datos cuando de verdad hace falta (`enabled`).
 *
 * Cada fila entera es un `<Link>` a `/projects/:id` (nada de botones anidados dentro).
 */
export function RecentProjectsCard() {
  const userId = useAuthStore((s) => s.user?.id);
  const recent = useRecentProjects(userId);
  const hasHistory = recent.length > 0;

  const { data, isLoading, isError } = useProjects(FALLBACK_PARAMS, {
    enabled: !hasHistory,
  });

  const items: RecentProjectItem[] = hasHistory
    ? recent.map(({ id, name, code, color }) => ({ id, name, code, color }))
    : (data?.data ?? []).map((project) => ({
        id: project.id,
        name: project.name,
        code: project.code ?? null,
        color: project.color,
      }));

  return (
    <section className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-1.5 text-base font-semibold text-on-surface">
          <Clock className="size-4 text-on-surface-variant" />
          Proyectos recientes
        </h2>
        <Link
          to="/projects"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Ver todos
          <ChevronRight className="size-4" />
        </Link>
      </div>

      {isLoading ? (
        <RecentProjectsSkeleton />
      ) : items.length > 0 ? (
        <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                to={`/projects/${item.id}`}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-container"
              >
                <span
                  aria-hidden
                  className={cn(
                    'size-2.5 shrink-0 rounded-full',
                    projectDot(item.color) ?? 'bg-outline-variant',
                  )}
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-on-surface">
                  {item.name}
                </span>
                {item.code && (
                  <span className="shrink-0 rounded-md bg-surface-container px-1.5 py-0.5 text-[11px] font-semibold text-on-surface-variant">
                    #{item.code}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-outline-variant/60 px-4 py-8 text-center">
          <FolderOpen className="size-6 text-on-surface-variant" />
          <p className="text-sm font-medium text-on-surface">
            {isError ? 'No se pudieron cargar tus proyectos' : 'Aún no tienes proyectos'}
          </p>
          <Link
            to="/projects"
            className="text-xs font-medium text-primary hover:underline"
          >
            Ir a Proyectos
          </Link>
        </div>
      )}
    </section>
  );
}

/** Placeholder de carga del fallback: filas finas con el mismo molde que la lista real. */
function RecentProjectsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5">
          <Skeleton className="size-2.5 shrink-0 rounded-full" />
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  );
}
