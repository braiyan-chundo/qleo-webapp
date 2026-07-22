import { useState } from 'react';
import { toast } from 'sonner';
import {
  Archive,
  ArchiveRestore,
  Loader2,
  MoreVertical,
  Pencil,
  Trash2,
} from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuthStore } from '@/store/auth.store';

import {
  useDeleteTask,
  useDiscardTask,
  useRestoreTask,
} from '../../hooks/use-tasks';
import type { Task } from '../../services/tasks.service';
import { TaskFormDialog } from '../TaskFormDialog';

interface TaskAdminMenuProps {
  task: Task;
  projectId: string;
  /** Se invoca tras **eliminar** con éxito: la tarea ya no existe, hay que navegar fuera. */
  onDeleted: () => void;
}

/**
 * (QL-142/QL-143/QL-178) Menú de acciones **solo-ADMIN** de la vista de tarea (la sección "Solo
 * administradores"). Kebab que agrupa:
 * - **Editar tarea** (§3.58): abre el formulario **completo** (datos, fecha límite con bloqueo
 *   y participantes) y lo guarda en un único `PATCH` atómico. Un ADMIN puede editar cualquier
 *   tarea aunque la creara otro.
 * - **Descartar / Restaurar** (papelera reversible, §3.41): saca la tarea del tablero sin
 *   destruirla, o la devuelve. Confirmación ligera al descartar; restaurar es directo.
 * - **Eliminar** (§3.40): hard-delete **irreversible** con cascada (adjuntos, comentarios,
 *   notificaciones…), tras un `AlertDialog` que advierte del alcance.
 *
 * Se renderiza `null` para no-ADMIN: estas acciones son exclusivas del rol de plataforma
 * `ADMIN` y el backend responde 403 a cualquier otro (no dependemos solo del gate de UI).
 */
export function TaskAdminMenu({ task, projectId, onDeleted }: TaskAdminMenuProps) {
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');

  const discardTask = useDiscardTask(projectId);
  const restoreTask = useRestoreTask(projectId);
  const deleteTask = useDeleteTask(projectId);

  const [editOpen, setEditOpen] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!isAdmin) return null;

  /**
   * (QL-178, §3.58) El rol de **solo lectura manda sobre el ADMIN**: un ADMIN que es OBSERVER
   * de la tarea recibe 403 `READ_ONLY_ROLE` en el PATCH, así que no le pintamos la acción.
   */
  const canFullEdit = task.currentUserRole !== 'OBSERVER';

  const handleDiscard = () => {
    discardTask.mutate(task.id, {
      onSuccess: () => {
        toast.success('Tarea descartada');
        setConfirmDiscard(false);
      },
      onError: (err) => {
        setConfirmDiscard(false);
        toast.error(err instanceof Error ? err.message : 'No se pudo descartar la tarea');
      },
    });
  };

  const handleRestore = () => {
    restoreTask.mutate(task.id, {
      onSuccess: () => toast.success('Tarea restaurada'),
      onError: (err) =>
        toast.error(err instanceof Error ? err.message : 'No se pudo restaurar la tarea'),
    });
  };

  const handleDelete = () => {
    deleteTask.mutate(task.id, {
      onSuccess: () => {
        toast.success(`Tarea "${task.title}" eliminada`);
        setConfirmDelete(false);
        onDeleted();
      },
      onError: (err) => {
        setConfirmDelete(false);
        toast.error(err instanceof Error ? err.message : 'No se pudo eliminar la tarea');
      },
    });
  };

  const busy = discardTask.isPending || restoreTask.isPending || deleteTask.isPending;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-outline-variant text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
          aria-label="Acciones de administrador"
          disabled={busy}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <MoreVertical className="size-4" />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>Solo administradores</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* (QL-178) Formulario completo: datos + fecha límite + participantes en un PATCH. */}
          {canFullEdit && (
            <>
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                <Pencil className="size-4" />
                Editar tarea
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          {task.isDiscarded ? (
            <DropdownMenuItem
              onSelect={handleRestore}
              disabled={restoreTask.isPending}
            >
              <ArchiveRestore className="size-4" />
              Restaurar tarea
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => setConfirmDiscard(true)}>
              <Archive className="size-4" />
              Descartar tarea
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setConfirmDelete(true)}
          >
            <Trash2 className="size-4" />
            Eliminar tarea
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* (QL-178) Edición COMPLETA solo-ADMIN. El diálogo gatea sus propias queries por `open`
          (columnas, proyecto y miembros), así que montarlo cerrado no cuesta peticiones. */}
      {canFullEdit && (
        <TaskFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          projectId={projectId}
          task={task}
          fullEdit
        />
      )}

      {/* Descartar: confirmación ligera (es reversible desde "Descartadas"). */}
      <AlertDialog
        open={confirmDiscard}
        onOpenChange={(o) => {
          if (!o) setConfirmDiscard(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar tarea</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-on-surface">{task.title}</span> saldrá del
              tablero y de "Mis tareas". Podrás restaurarla desde la sección
              <span className="font-medium text-on-surface"> Descartadas</span> del proyecto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={discardTask.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDiscard();
              }}
              disabled={discardTask.isPending}
            >
              {discardTask.isPending && <Loader2 className="animate-spin" />}
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Eliminar: irreversible, con cascada. Advertencia fuerte. */}
      <AlertDialog
        open={confirmDelete}
        onOpenChange={(o) => {
          if (!o) setConfirmDelete(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar tarea permanentemente</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a eliminar{' '}
              <span className="font-medium text-on-surface">{task.title}</span> y{' '}
              <span className="font-medium text-error">todo lo que cuelga de ella</span>:
              adjuntos, comentarios, checklist, tiempos y notificaciones. Esta acción es{' '}
              <span className="font-medium text-error">irreversible</span> y no se puede
              deshacer. Para retirarla sin destruirla, usa <em>Descartar</em>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteTask.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleteTask.isPending}
            >
              {deleteTask.isPending && <Loader2 className="animate-spin" />}
              Eliminar definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
