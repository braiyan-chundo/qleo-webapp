import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Inbox, MoreHorizontal, Plus, Settings2, Star } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

import type { Column } from '@/features/columns/services/columns.service';

import type { Task } from '../services/tasks.service';
import { columnColor } from '../lib/palette';
import { SortableTaskCard } from './SortableTaskCard';

interface BoardColumnProps {
  column: Column;
  /** Posición de la columna (para derivar un color estable si `color` es null). */
  index: number;
  tasks: Task[];
  onOpenTask: (id: string) => void;
  /** Abre el diálogo de "Configurar tablero". */
  onConfigure: () => void;
  /** Abre el formulario de nueva tarea preseteando esta columna. */
  onAddTask: (columnId: string) => void;
}

/**
 * Carril de una columna de estado (QL-15): contenedor *droppable* + `SortableContext`
 * vertical con sus tareas ordenadas por `order`. El id droppable es el `columnId`, así el
 * board puede resolver el destino incluso al soltar sobre una columna vacía. El encabezado
 * muestra un punto de color (token), el nombre, el contador y un menú `···`; al pie hay un
 * botón para añadir una tarea directamente en esta columna.
 */
export function BoardColumn({
  column,
  index,
  tasks,
  onOpenTask,
  onConfigure,
  onAddTask,
}: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: 'column', columnId: column.id },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        // QL-36: `h-full min-h-0` para llenar el alto que le da la grid del board; el
        // encabezado y el botón "Añadir tarea" quedan fijos y solo scrollea la lista.
        'flex h-full min-h-0 flex-col rounded-xl border p-3 transition-colors',
        isOver
          ? 'border-primary/60 bg-primary-container/30'
          : 'border-outline-variant/40 bg-surface-container-low',
      )}
    >
      <header className="mb-3 flex shrink-0 items-center justify-between gap-2 px-1">
        <span className="flex min-w-0 items-center gap-2">
          <span
            className={cn('size-2.5 shrink-0 rounded-full', columnColor(column.color, index))}
            aria-hidden
          />
          <span className="truncate text-sm font-semibold text-on-surface">
            {column.name}
          </span>
          {column.isDefault && (
            <Star
              className="size-3.5 shrink-0 text-primary"
              aria-label="Columna por defecto"
            />
          )}
          <span className="shrink-0 text-xs font-medium text-on-surface-variant">
            {tasks.length}
          </span>
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            aria-label="Acciones de la columna"
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onAddTask(column.id)}>
              <Plus className="size-4" />
              Añadir tarea
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onConfigure}>
              <Settings2 className="size-4" />
              Configurar tablero
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto min-h-0 -mx-1 px-1">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-outline-variant/50 px-3 py-6 text-center">
              <Inbox className="size-5 text-on-surface-variant" />
              <p className="text-xs text-on-surface-variant">
                No hay tareas en esta fase
              </p>
            </div>
          ) : (
            tasks.map((task) => (
              <SortableTaskCard
                key={task.id}
                task={task}
                onClick={() => onOpenTask(task.id)}
              />
            ))
          )}
        </div>
      </SortableContext>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-2 w-full shrink-0 justify-start text-on-surface-variant"
        onClick={() => onAddTask(column.id)}
      >
        <Plus className="size-4" />
        Añadir tarea
      </Button>
    </div>
  );
}
