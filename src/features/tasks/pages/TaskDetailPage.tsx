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
import { TaskColumnMover } from '../components/detail/TaskColumnMover';
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

  // (QL-151) Botón "Volver" en línea a la izquierda del título (patrón de QL-140). El margen
  // inferior lo aporta la fila contenedora, no el propio botón, para no duplicar espacio.
  const backButton = (
    <BackButton fallback={{ to: `/projects/${projectId}`, label: 'Proyecto' }} />
  );

  if (isLoading) {
    return (
      <div className="p-4 md:p-8">
        <div className="mb-6 flex items-start gap-3">
          {backButton}
          <div className="min-w-0 flex-1 space-y-3">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
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
        <div className="flex items-start gap-3">
          {backButton}
          <div className="min-w-0 flex-1 rounded-xl border border-error/20 bg-error-container px-6 py-10 text-center">
            <p className="text-sm font-medium text-on-error-container">
              No se pudo cargar la tarea
            </p>
            <p className="mt-1 text-xs text-on-error-container/80">
              {error instanceof Error ? error.message : 'Tarea no encontrada'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isCreator = task.currentUserRole === 'CREATOR';
  const isAdmin = user?.role === 'ADMIN';
  // (QL-141) Columna actual + su posición ordenada (para el color estable del chip).
  const columnIndex = columns?.findIndex((c) => c.id === task.columnId) ?? -1;
  const column = columnIndex >= 0 ? columns?.[columnIndex] : undefined;

  return (
    <div className="p-4 md:p-8">
      {/* (QL-151) Fila "Volver + título": el botón `size=icon` `shrink-0` a la izquierda y el
          header ocupando el resto (`min-w-0 flex-1`); `items-start` alinea el botón con la línea
          del título, no con los badges. El `mb-6` de la fila reemplaza al del header. */}
      <div className="mb-6 flex items-start gap-3">
        {backButton}
        <TaskDetailHeader
          task={task}
          column={column}
          columnIndex={columnIndex}
          titleAs="h1"
          className="min-w-0 flex-1"
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
      </div>

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
          {/* (QL-141) Mover la tarea entre columnas contiguas (siguiente/anterior). */}
          <TaskColumnMover task={task} projectId={projectId} />

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
