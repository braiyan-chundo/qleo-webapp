import { ArrowLeft, ArrowRight, Columns3, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';

import { useColumns } from '@/features/columns/hooks/use-columns';
import type { Column } from '@/features/columns/services/columns.service';
import { useProject } from '@/features/projects/hooks/use-projects';
import { canManageProject } from '@/features/projects/utils/permissions';

import { useMoveTask, useTasks } from '../../hooks/use-tasks';
import type { Task } from '../../services/tasks.service';
import { canMoveTask } from '../../lib/roles';
import { columnColor } from '../../lib/palette';

interface TaskColumnMoverProps {
  task: Task;
  projectId: string;
}

/**
 * (QL-141) Control de columna en el detalle de una tarea: muestra la **columna actual** (con su
 * punto de color) y ofrece **"Mover a: {siguiente}"** / **"Volver a: {anterior}"** para avanzar o
 * retroceder la tarea por el tablero **de una en una columna**.
 *
 * El movimiento es **secuencial ±1** (QL-135): "siguiente" es la columna con `order + 1` y
 * "anterior" la de `order − 1`. En los extremos (primera/última columna) el botón que no aplica se
 * **oculta**. Como estos botones solo mueven a una columna contigua, siempre cumplen la regla
 * secuencial, así que el `bypassSequence` del board aquí es irrelevante.
 *
 * Reutiliza la mutación `useMoveTask` (la misma del drag & drop del board): coloca la tarea al
 * **final** de la columna destino (como al soltar sobre un carril) e invalida listado y detalle.
 * El 409 `COLUMN_SEQUENCE_VIOLATION` y el `READ_ONLY_ROLE` los gestiona de forma defensiva
 * `useMoveTask.onError` (revierte el optimista + toast); aquí solo pueden aparecer en una carrera
 * (otra sesión reordenó las columnas), no por uso normal.
 *
 * Permisos: misma condición que el board para permitir mover — participante que puede mover
 * (CREATOR/ASSIGNEE/COLLABORATOR, `canMoveTask`) **o** quien gestiona el proyecto
 * (ADMIN/creador/gestor, `canManageProject`). Un OBSERVER (solo lectura) no ve los botones.
 */
export function TaskColumnMover({ task, projectId }: TaskColumnMoverProps) {
  const user = useAuthStore((s) => s.user);
  const { data: columns } = useColumns(projectId);
  const { data: tasks } = useTasks(projectId);
  const { data: project } = useProject(projectId);
  const moveTask = useMoveTask(projectId);

  // Mismo gate que el board (nunca recalcular la expresión a mano en cada consumidor). Una tarea
  // descartada no está en el tablero, así que —igual que en el board— tampoco se mueve desde aquí.
  const canMove = canMoveTask(task.currentUserRole) || canManageProject(project, user);
  if (!canMove || task.isDiscarded) return null;

  const ordered = columns ?? [];
  const index = ordered.findIndex((c) => c.id === task.columnId);
  const current = index >= 0 ? ordered[index] : undefined;
  if (!current) return null;

  // Contigüidad por `Column.order`: siguiente = order + 1, anterior = order − 1.
  const next = ordered.find((c) => c.order === current.order + 1);
  const prev = ordered.find((c) => c.order === current.order - 1);
  // Columna aislada (sin contigua a ningún lado): no hay nada que mover, no pintamos el control.
  if (!next && !prev) return null;

  const pending = moveTask.isPending;

  function moveTo(target: Column) {
    // Al final de la columna destino, igual que al soltar sobre el carril en el board.
    const destOrder = (tasks ?? []).filter(
      (t) => t.columnId === target.id && t.id !== task.id,
    ).length;
    moveTask.mutate({ id: task.id, data: { columnId: target.id, order: destOrder } });
  }

  return (
    <section className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-4 py-3">
      <p className="flex items-center gap-1.5 text-sm font-medium text-on-surface">
        <Columns3 className="size-4 text-on-surface-variant" />
        Columna
      </p>
      <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-on-surface-variant">
        <span
          className={cn('size-2.5 shrink-0 rounded-full', columnColor(current.color, index))}
          aria-hidden
        />
        {current.name}
      </p>

      <div className="mt-3 flex flex-col gap-2">
        {next && (
          <Button
            type="button"
            size="sm"
            className="justify-start"
            onClick={() => moveTo(next)}
            disabled={pending}
          >
            {pending ? <Loader2 className="animate-spin" /> : <ArrowRight />}
            Mover a: {next.name}
          </Button>
        )}
        {prev && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="justify-start"
            onClick={() => moveTo(prev)}
            disabled={pending}
          >
            {pending ? <Loader2 className="animate-spin" /> : <ArrowLeft />}
            Volver a: {prev.name}
          </Button>
        )}
      </div>
    </section>
  );
}
