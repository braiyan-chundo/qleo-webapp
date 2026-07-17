import type { QueryClient } from '@tanstack/react-query';

import { projectKeys } from '@/features/projects/hooks/use-projects';
import type { Project } from '@/features/projects/types/project';
import { taskKeys } from '@/features/tasks/hooks/use-tasks';
import type { Task } from '@/features/tasks/services/tasks.service';

/**
 * Resolutor de etiquetas legibles para el historial de navegación (QL-140). Mapea un `pathname`
 * a un nombre amable para el tooltip del `BackButton` ("Volver a: {destino}").
 *
 * Se resuelve en el **render** del `BackButton` (no al registrar la visita) para que los nombres
 * dinámicos —proyecto, tarea— reflejen la caché de TanStack Query en el momento de mostrarse: al
 * estar en el detalle de una tarea, el proyecto padre suele seguir en caché, así que el tooltip
 * muestra su nombre real en vez de un genérico.
 */

/** Etiqueta genérica cuando la ruta no se reconoce o no se puede resolver un nombre mejor. */
export const GENERIC_BACK_LABEL = 'atrás';

/** Rutas estáticas conocidas → nombre amable (deben coincidir con las rutas de `App.tsx`). */
const STATIC_LABELS: Record<string, string> = {
  '/': 'Inicio',
  '/muro': 'Muro',
  '/projects': 'Proyectos',
  '/tasks': 'Mis tareas',
  '/profile': 'Mi cuenta',
  '/help': 'Ayuda',
  '/analytics': 'Analíticas',
  '/notifications': 'Notificaciones',
  '/admin': 'Usuarios',
  '/audit': 'Historial de cambios',
  '/calendar': 'Calendario laboral',
};

/** `/projects/:id/tasks/:taskId` → captura `taskId`. */
const TASK_DETAIL_RE = /^\/projects\/[^/]+\/tasks\/([^/]+)$/;
/** `/projects/:id` → captura `id`. */
const PROJECT_DETAIL_RE = /^\/projects\/([^/]+)$/;

export function resolveNavLabel(
  pathname: string,
  queryClient: QueryClient,
): string {
  const staticLabel = STATIC_LABELS[pathname];
  if (staticLabel) return staticLabel;

  const taskMatch = TASK_DETAIL_RE.exec(pathname);
  if (taskMatch) {
    const task = queryClient.getQueryData<Task>(taskKeys.detail(taskMatch[1]));
    return task?.title ?? 'Tarea';
  }

  const projectMatch = PROJECT_DETAIL_RE.exec(pathname);
  if (projectMatch) {
    const project = queryClient.getQueryData<Project>(
      projectKeys.detail(projectMatch[1]),
    );
    return project?.name ?? 'Proyecto';
  }

  return GENERIC_BACK_LABEL;
}
