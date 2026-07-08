import { Link } from 'react-router-dom';
import { ClipboardList, Folder } from 'lucide-react';

/**
 * Acciones rápidas del dashboard (§3.14). Solo destinos que YA existen en la app: no
 * inventa features sin backing. "Ver mis tareas" → `/tasks`; "Ver proyectos" → `/projects`
 * (donde se crea un nuevo proyecto). La creación de tareas vive dentro de cada proyecto,
 * así que no se ofrece un "Nueva tarea" suelto sin contexto de proyecto.
 */
export function QuickActions() {
  return (
    <section className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-5">
      <h2 className="mb-4 text-base font-semibold text-on-surface">Acciones rápidas</h2>
      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/tasks"
          className="flex flex-col items-start gap-2 rounded-lg border border-outline-variant/40 bg-surface-container px-4 py-3 transition-colors hover:bg-surface-container-high"
        >
          <ClipboardList className="size-5 text-primary" />
          <span className="text-sm font-medium text-on-surface">Ver mis tareas</span>
        </Link>
        <Link
          to="/projects"
          className="flex flex-col items-start gap-2 rounded-lg border border-outline-variant/40 bg-surface-container px-4 py-3 transition-colors hover:bg-surface-container-high"
        >
          <Folder className="size-5 text-primary" />
          <span className="text-sm font-medium text-on-surface">Ver proyectos</span>
        </Link>
      </div>
    </section>
  );
}
