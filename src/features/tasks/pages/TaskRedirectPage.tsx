import { Navigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { NotFoundPage } from '@/shared/components/NotFoundPage';

import { useTask } from '../hooks/use-tasks';

/**
 * Resolutor de la ruta **plana** `/tasks/:taskId` → la ruta anidada real
 * `/projects/:projectId/tasks/:taskId`. Existe porque las notificaciones **push** del backend
 * abren `/tasks/{taskId}` (§3.10/§3.17), pero la vista de tarea vive anidada bajo su proyecto.
 *
 * Resuelve el proyecto con `useTask` (TanStack Query — `GET /tasks/:id` trae `projectId`) y
 * redirige (`replace`). Mientras carga, un spinner; si la tarea no existe / sin acceso (404),
 * muestra el 404 de marca. El click in-app NO pasa por aquí (usa `resolveNotificationHref`).
 */
export function TaskRedirectPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const { data: task, isLoading, isError } = useTask(taskId);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-on-surface-variant" />
      </div>
    );
  }

  if (isError || !task) {
    return <NotFoundPage />;
  }

  return (
    <Navigate to={`/projects/${task.projectId}/tasks/${taskId}`} replace />
  );
}
