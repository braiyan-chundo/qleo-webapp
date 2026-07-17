import { useNavigate, useParams } from 'react-router-dom';

import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { BackButton } from '@/shared/components/BackButton';
import { useAuthStore } from '@/store/auth.store';

import { useColumns } from '@/features/columns/hooks/use-columns';
import { ChecklistPanel } from '@/features/checklists/components/ChecklistPanel';
import { CommentsPanel } from '@/features/comments/components/CommentsPanel';
import { AttachmentsPanel } from '@/features/attachments/components/AttachmentsPanel';

import { useTask } from '../hooks/use-tasks';
import { CompletionSection } from '../components/CompletionSection';
import { DeadlineSection } from '../components/DeadlineSection';
import { TimeTrackerSection } from '../components/TimeTrackerSection';
import { TaskAnalyticsSection } from '../components/TaskAnalyticsSection';
import { RoleManager } from '../components/RoleManager';
import { TaskDetailHeader } from '../components/detail/TaskDetailHeader';
import { TaskDescription } from '../components/detail/TaskDescription';
import { TaskCreatorActions } from '../components/detail/TaskCreatorActions';
import { TaskAdminMenu } from '../components/detail/TaskAdminMenu';
import { TaskAuditLogSection } from '../components/detail/TaskAuditLogSection';

/**
 * Vista dedicada y deep-linkable de una tarea (QL-25): `/projects/:id/tasks/:taskId`. Layout
 * de dos columnas — la principal reúne descripción, checklist, adjuntos y comentarios; la
 * lateral, el estado (columna), completar/reabrir, fecha límite, cronómetro, roles y
 * (para el Creador) editar/eliminar. En móvil las columnas se apilan. Todo el dato del
 * servidor vive en la caché de TanStack Query; los paneles se reutilizan tal cual del modal.
 */
export function TaskDetailPage() {
  const { id: projectId = '', taskId } = useParams<{ id: string; taskId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const { data: task, isLoading, isError, error } = useTask(taskId);
  const { data: columns } = useColumns(projectId || undefined);

  const backToProject = (
    <BackButton
      fallback={{ to: `/projects/${projectId}`, label: 'Proyecto' }}
      className="mb-6"
    />
  );

  if (isLoading) {
    return (
      <div className="p-4 md:p-8">
        {backToProject}
        <Skeleton className="mb-3 h-8 w-2/3" />
        <Skeleton className="mb-6 h-4 w-1/3" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-4">
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-40 w-full rounded-lg" />
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !task) {
    return (
      <div className="p-4 md:p-8">
        {backToProject}
        <div className="rounded-xl border border-error/20 bg-error-container px-6 py-10 text-center">
          <p className="text-sm font-medium text-on-error-container">
            No se pudo cargar la tarea
          </p>
          <p className="mt-1 text-xs text-on-error-container/80">
            {error instanceof Error ? error.message : 'Tarea no encontrada'}
          </p>
        </div>
      </div>
    );
  }

  const isCreator = task.currentUserRole === 'CREATOR';
  const isAdmin = user?.role === 'ADMIN';
  const columnName = columns?.find((c) => c.id === task.columnId)?.name;

  return (
    <div className="p-4 md:p-8">
      {backToProject}

      <TaskDetailHeader
        task={task}
        columnName={columnName}
        titleAs="h1"
        className="mb-6"
        actions={
          // (QL-142/143) Menú solo-ADMIN: descartar/restaurar y eliminar (con cascada).
          // Se renderiza `null` internamente para no-ADMIN.
          <TaskAdminMenu
            task={task}
            projectId={projectId}
            onDeleted={() => navigate(`/projects/${projectId}`)}
          />
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        {/* Columna principal: contenido de trabajo. */}
        <div className="space-y-4">
          <TaskDescription description={task.description} />

          <ChecklistPanel
            task={{ id: task.id, currentUserRole: task.currentUserRole }}
          />

          <AttachmentsPanel
            task={{ id: task.id, currentUserRole: task.currentUserRole }}
          />

          <CommentsPanel
            task={{ id: task.id, currentUserRole: task.currentUserRole }}
          />
        </div>

        {/* Columna lateral: estado, plazos, roles y acciones. */}
        <aside className="space-y-4 lg:sticky lg:top-6">
          <CompletionSection task={task} projectId={projectId} />

          <DeadlineSection task={task} projectId={projectId} />

          <TimeTrackerSection task={task} />

          <RoleManager task={task} />

          {isCreator && (
            <>
              <Separator />
              <TaskCreatorActions task={task} projectId={projectId} layout="stacked" />
            </>
          )}
        </aside>
      </div>

      {/* Sección "Solo administradores" (req. 3+4): historial de logs de la tarea (QL-144) y
          análisis por-tarea (P5). Solo ADMIN de plataforma; el borrado/descarte vive en el
          menú kebab de la cabecera (`TaskAdminMenu`). */}
      {isAdmin && (
        <div className="mt-8 space-y-8">
          <TaskAuditLogSection taskId={task.id} />
          <TaskAnalyticsSection taskId={task.id} />
        </div>
      )}
    </div>
  );
}
