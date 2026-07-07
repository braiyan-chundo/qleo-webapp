import { Link } from 'react-router-dom';
import { Target } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { FocusProject } from '../services/dashboard.service';

interface FocusProjectCardProps {
  project: FocusProject | null;
}

/**
 * Tarjeta "Foco Principal" (§3.14): el proyecto con actividad más reciente donde el
 * usuario participa. Muestra nombre, `#code`, una barra de progreso con `progressPct`
 * (0–100) y un botón "Ver proyecto". Si `focusProject` es `null`, un placeholder amable.
 */
export function FocusProjectCard({ project }: FocusProjectCardProps) {
  return (
    <section className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-5">
      <p className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-on-surface-variant">
        <Target className="size-4" />
        Foco principal
      </p>

      {project ? (
        <>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            {project.code && (
              <span className="rounded-md bg-primary-container px-2 py-0.5 text-xs font-semibold text-on-primary-container">
                #{project.code}
              </span>
            )}
          </div>
          <h3 className="truncate text-lg font-semibold text-on-surface">
            {project.name}
          </h3>

          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-on-surface-variant">Progreso</span>
              <span className="font-semibold tabular-nums text-on-surface">
                {project.progressPct}%
              </span>
            </div>
            <Progress value={project.progressPct} className="h-2" />
          </div>

          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link to={`/projects/${project.id}`}>Ver proyecto</Link>
          </Button>
        </>
      ) : (
        <p className="text-sm text-on-surface-variant">
          Aún no tienes un proyecto foco. Cuando participes en tareas, aquí verás el
          proyecto con más actividad.
        </p>
      )}
    </section>
  );
}
