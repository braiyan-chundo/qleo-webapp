import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Flag, Inbox, Play, Plus, Star } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
  /**
   * (QL-135) `true` mientras se arrastra una tarea para la que esta columna **no** es un
   * destino válido (no contigua a la de origen). La columna se atenúa y deja de aceptar el
   * drop —tanto en su zona libre como sobre sus tarjetas—, así que dnd-kit la ignora y el
   * arrastre se ancla al destino válido más cercano.
   */
  dropDisabled?: boolean;
  /** Click en una tarjeta → abre la tarea (QL-123: navega a su vista completa, sin modal). */
  onOpenTask: (id: string) => void;
  /** Abre el formulario de nueva tarea preseteando esta columna. */
  onAddTask: (columnId: string) => void;
}

interface BoundaryMarkProps {
  icon: LucideIcon;
  /** Etiqueta corta para lectores de pantalla ("Columna de inicio" / "Columna de fin"). */
  label: string;
  /** Clase de color del acento (token). */
  className: string;
  /** Texto del tooltip: explica qué implica la marca. */
  children: React.ReactNode;
}

/**
 * Marca de cabecera del papel de la columna en el flujo (QL-134). La información **no va solo
 * en el color**: el icono lleva `aria-label` para quien no distinga los tintes, y el tooltip
 * explica el significado a quien no reconozca el icono.
 */
function BoundaryMark({ icon: Icon, label, className, children }: BoundaryMarkProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Icon
          className={cn('size-3.5 shrink-0 fill-current', className)}
          aria-label={label}
        />
      </TooltipTrigger>
      <TooltipContent>{children}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Tinte de fondo según el papel de la columna en el flujo (QL-134, sobre las marcas de QL-62).
 * Intencionalmente **tenue**: la columna sigue siendo un contenedor de trabajo, no un cartel,
 * así que el tinte no debe competir con el punto de color (configurable por el usuario) ni
 * restarle contraste a las tarjetas. Los tokens ya resuelven claro/oscuro por sí solos.
 *
 * Caso borde: el backend permite como máximo una columna `isStart` y una `isEnd`, pero nada
 * impide que sean la **misma** columna. Ahí se degrada de un tinte al otro (y la cabecera
 * pinta las dos marcas), en vez de que un `if` gane arbitrariamente.
 */
function boundarySurface(column: Column): string {
  if (column.isStart && column.isEnd) {
    return 'bg-linear-to-b from-column-start-surface to-column-end-surface';
  }
  if (column.isStart) return 'bg-column-start-surface';
  if (column.isEnd) return 'bg-column-end-surface';
  return 'bg-surface-container-low';
}

/**
 * Carril de una columna de estado (QL-15): contenedor *droppable* + `SortableContext`
 * vertical con sus tareas ordenadas por `order`. El id droppable es el `columnId`, así el
 * board puede resolver el destino incluso al soltar sobre una columna vacía. El encabezado
 * muestra un punto de color (token), el nombre, el contador y un botón `+` para añadir una
 * tarea directamente en esta columna; la configuración del tablero vive en la cabecera de la
 * página (antes duplicada en un menú `···` por columna).
 */
export function BoardColumn({
  column,
  index,
  tasks,
  dropDisabled,
  onOpenTask,
  onAddTask,
}: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: 'column', columnId: column.id },
    disabled: dropDisabled,
  });

  return (
    <div
      ref={setNodeRef}
      aria-disabled={dropDisabled || undefined}
      className={cn(
        // QL-36: `h-full min-h-0` para llenar el alto que le da el board; el encabezado queda
        // fijo y solo scrollea la lista de tarjetas.
        'flex h-full min-h-0 flex-col rounded-xl border p-3 transition-colors',
        // QL-117: en móvil cada columna ocupa medio ancho visible (menos medio gap) y se ancla
        // al snap para ver ~2 columnas por slide. En sm+ pasa a un ancho fijo (18rem) con
        // `shrink-0`, de modo que en desktop entran varias y las sobrantes quedan accesibles con
        // scroll horizontal (sin wrap); cuanto más ancha la pantalla, más columnas visibles.
        'w-[calc(50%-0.5rem)] shrink-0 snap-start sm:w-72',
        // (QL-135) Destino no válido: se atenúa y el borde pasa a discontinuo (la señal no va
        // solo en la opacidad) mientras dura el arrastre. `isOver` nunca es true aquí: con el
        // droppable desactivado dnd-kit ni considera la columna.
        dropDisabled
          ? 'cursor-not-allowed border-dashed border-outline-variant/40 bg-surface-container-low opacity-40'
          : isOver
            ? 'border-primary/60 bg-primary-container/30'
            : cn('border-outline-variant/40', boundarySurface(column)),
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
          {/* QL-134: si la columna es inicio Y fin a la vez, se pintan las dos marcas. */}
          {column.isStart && (
            <BoundaryMark
              icon={Play}
              label="Columna de inicio"
              className="text-column-start-accent"
            >
              Columna de inicio — al mover una tarea aquí se registra cuándo empezó
            </BoundaryMark>
          )}
          {column.isEnd && (
            <BoundaryMark
              icon={Flag}
              label="Columna de fin"
              className="text-column-end-accent"
            >
              Columna de fin — al mover una tarea aquí se registra cuándo terminó (no la
              completa: eso es una acción aparte)
            </BoundaryMark>
          )}
          <span className="shrink-0 text-xs font-medium text-on-surface-variant">
            {tasks.length}
          </span>
        </span>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0 text-on-surface-variant hover:text-on-surface"
              onClick={() => onAddTask(column.id)}
              aria-label={`Añadir tarea en ${column.name}`}
            >
              <Plus className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Añadir tarea</TooltipContent>
        </Tooltip>
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
                // (QL-135) Sin esto, soltar sobre una TARJETA de una columna atenuada seguiría
                // resolviendo el destino a esa columna: el carril estaría desactivado pero sus
                // tarjetas no. Las cards siguen siendo arrastrables (salir de aquí sí vale).
                dropDisabled={dropDisabled}
                onClick={() => onOpenTask(task.id)}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}
