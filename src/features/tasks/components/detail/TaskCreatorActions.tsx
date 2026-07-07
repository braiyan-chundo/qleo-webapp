import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Pencil, Trash2 } from 'lucide-react';

import { ApiError } from '@/core/api/fetch-client';
import { Button } from '@/components/ui/button';
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

import { useDeleteTask } from '../../hooks/use-tasks';
import type { Task } from '../../services/tasks.service';
import { TaskFormDialog } from '../TaskFormDialog';

interface TaskCreatorActionsProps {
  task: Task;
  projectId: string;
  /** Callback tras eliminar con éxito (cerrar el modal o navegar fuera de la página). */
  onDeleted: () => void;
  /** Distribución de los botones. `stacked` = a lo ancho (columna lateral de la página). */
  layout?: 'inline' | 'stacked';
}

/**
 * Acciones del Creador sobre la tarea (QL-25): Editar y Eliminar. Extraído para que la página
 * dedicada y el modal de vistazo compartan la misma lógica de borrado (confirmación + manejo
 * de `TASK_OWNERSHIP_REQUIRED`) sin duplicarla. Solo se renderiza si el usuario es CREATOR.
 */
export function TaskCreatorActions({
  task,
  projectId,
  onDeleted,
  layout = 'inline',
}: TaskCreatorActionsProps) {
  const deleteTask = useDeleteTask(projectId);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = () => {
    deleteTask.mutate(task.id, {
      onSuccess: () => {
        toast.success('Tarea eliminada');
        setConfirmDelete(false);
        onDeleted();
      },
      onError: (err) => {
        setConfirmDelete(false);
        if (err instanceof ApiError && err.code === 'TASK_OWNERSHIP_REQUIRED') {
          toast.error('Solo el Creador de la tarea puede eliminarla.');
          return;
        }
        toast.error(err instanceof Error ? err.message : 'No se pudo eliminar la tarea');
      },
    });
  };

  const stacked = layout === 'stacked';

  return (
    <>
      <div className={stacked ? 'flex flex-col gap-2' : 'flex items-center gap-2'}>
        <Button
          type="button"
          variant="outline"
          onClick={() => setEditOpen(true)}
          className={stacked ? 'w-full justify-center' : undefined}
        >
          <Pencil />
          Editar
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={() => setConfirmDelete(true)}
          disabled={deleteTask.isPending}
          className={stacked ? 'w-full justify-center' : undefined}
        >
          <Trash2 />
          Eliminar
        </Button>
      </div>

      <TaskFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        projectId={projectId}
        task={task}
      />

      <AlertDialog
        open={confirmDelete}
        onOpenChange={(o) => {
          if (!o) setConfirmDelete(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar tarea</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Seguro que quieres eliminar{' '}
              <span className="font-medium text-on-surface">{task.title}</span>? Esta
              acción no se puede deshacer.
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
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
