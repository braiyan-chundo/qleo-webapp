import { useState } from 'react';
import { Pencil } from 'lucide-react';

import { Button } from '@/components/ui/button';

import type { Task } from '../../services/tasks.service';
import { TaskFormDialog } from '../TaskFormDialog';

interface TaskCreatorActionsProps {
  task: Task;
  projectId: string;
  /** Distribución del botón. `stacked` = a lo ancho (columna lateral de la página). */
  layout?: 'inline' | 'stacked';
}

/**
 * Acción del Creador sobre la tarea (QL-25): **Editar** (solo el CREATOR puede, §3.7). Solo se
 * renderiza si el usuario es CREATOR.
 *
 * (QL-143) El borrado dejó de vivir aquí: eliminar es ahora **solo-ADMIN** con cascada, y
 * descartar/restaurar también. Ambas viven en el menú kebab `TaskAdminMenu` de la cabecera, así
 * un CREATOR no-admin ya no ve un botón "Eliminar" que el backend rechazaría con 403.
 */
export function TaskCreatorActions({
  task,
  projectId,
  layout = 'inline',
}: TaskCreatorActionsProps) {
  const [editOpen, setEditOpen] = useState(false);
  const stacked = layout === 'stacked';

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setEditOpen(true)}
        className={stacked ? 'w-full justify-center' : undefined}
      >
        <Pencil />
        Editar
      </Button>

      <TaskFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        projectId={projectId}
        task={task}
      />
    </>
  );
}
