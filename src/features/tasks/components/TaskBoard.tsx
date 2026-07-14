import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Settings2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { useColumns } from '@/features/columns/hooks/use-columns';

import { useMoveTask, useTasks } from '../hooks/use-tasks';
import type { Task } from '../services/tasks.service';
import { canMoveTask } from '../lib/roles';
import { TaskCard } from './TaskCard';
import { BoardColumn } from './BoardColumn';
import { TaskFormDialog } from './TaskFormDialog';
import { TaskDetailDialog } from './TaskDetailDialog';
import { BoardSettingsDialog } from './BoardSettingsDialog';

interface TaskBoardProps {
  projectId: string;
  /** Estado del diálogo de crear tarea, controlado por la página (botón "Nueva tarea"). */
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
  /**
   * Filtro del board (compartido entre vistas). Se aplica a las tareas tras cargarlas para
   * que Kanban/Gantt/Planner muestren el mismo subconjunto. Por defecto, identidad.
   */
  filterTasks?: (tasks: Task[]) => Task[];
}

/**
 * Tablero de tareas (QL-07) con drag & drop (QL-15): carriles verticales = columnas de
 * estado (de `useColumns`), agrupando las tareas por `columnId` y ordenadas por `order`.
 * Arrastrar reordena dentro de una columna o mueve entre columnas vía `useMoveTask`
 * (optimista). Un click normal sigue abriendo el detalle (el sensor exige mover 6px antes
 * de iniciar el drag). La configuración del tablero (etapas/columnas) vive en un diálogo
 * aparte para dejar el board como contenido primario.
 */
export function TaskBoard({
  projectId,
  createOpen,
  onCreateOpenChange,
  filterTasks,
}: TaskBoardProps) {
  const {
    data: rawTasks,
    isLoading: tasksLoading,
    isError: tasksError,
    error: tasksErrorObj,
  } = useTasks(projectId);
  const { data: columns, isLoading: columnsLoading } = useColumns(projectId);
  const moveTask = useMoveTask(projectId);

  // Aplica el filtro compartido del board (si lo hay) sobre las tareas cargadas.
  const tasks = useMemo(
    () => (filterTasks ? filterTasks(rawTasks ?? []) : rawTasks),
    [rawTasks, filterTasks],
  );

  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeId, setActiveId] = useState<string | null>(null);

  // Deep-link opcional `?task=<id>` sobre el tablero: abre el vistazo rápido (modal) y limpia
  // el parámetro para no reabrirlo al cerrar. Convención "modal = vistazo" (QL-25); la vista
  // completa vive en su propia ruta `/projects/:id/tasks/:taskId` (a la que navega el modal).
  useEffect(() => {
    const taskParam = searchParams.get('task');
    if (!taskParam) return;
    setOpenTaskId(taskParam);
    const next = new URLSearchParams(searchParams);
    next.delete('task');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  /** Columna preseteada al abrir el form desde "+ Añadir tarea" de una columna. */
  const [presetColumnId, setPresetColumnId] = useState<string | undefined>();

  // Un click normal debe seguir abriendo el detalle: solo iniciamos el drag tras 6px.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Agrupa las tareas por columna, ordenadas por `order` asc.
  const tasksByColumn = useMemo(() => {
    const map = new Map<string, Task[]>();
    columns?.forEach((c) => map.set(c.id, []));
    tasks?.forEach((t) => {
      const bucket = map.get(t.columnId);
      if (bucket) bucket.push(t);
      else map.set(t.columnId, [t]);
    });
    map.forEach((bucket) => bucket.sort((a, b) => a.order - b.order));
    return map;
  }, [tasks, columns]);

  const activeTask = useMemo(
    () => tasks?.find((t) => t.id === activeId) ?? null,
    [tasks, activeId],
  );

  const isLoading = tasksLoading || columnsLoading;
  const noColumns = !columnsLoading && (!columns || columns.length === 0);
  // El filtro dejó 0 tareas visibles aunque el proyecto sí tenga tareas.
  const noFilterMatches =
    !isLoading &&
    !tasksError &&
    !!filterTasks &&
    (rawTasks?.length ?? 0) > 0 &&
    (tasks?.length ?? 0) === 0;

  function openCreateForColumn(columnId: string) {
    setPresetColumnId(columnId);
    onCreateOpenChange(true);
  }

  function handleCreateOpenChange(open: boolean) {
    if (!open) setPresetColumnId(undefined);
    onCreateOpenChange(open);
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeTaskId = String(active.id);
    const moved = tasks?.find((t) => t.id === activeTaskId);
    if (!moved || !canMoveTask(moved.currentUserRole)) return;

    // `over` puede ser otra tarea (reordenar/soltar junto a ella) o una columna vacía.
    const overId = String(over.id);
    const overData = over.data.current as
      | { type?: string; columnId?: string }
      | undefined;

    // Columna destino: si soltamos sobre una card, su columna; si sobre una lane, su id.
    const destColumnId =
      overData?.type === 'task'
        ? (overData.columnId as string)
        : overData?.type === 'column'
          ? (overData.columnId as string)
          : overId;

    // Tareas actuales de la columna destino, ordenadas y sin la que movemos.
    const destTasks = (tasksByColumn.get(destColumnId) ?? []).filter(
      (t) => t.id !== activeTaskId,
    );

    // Índice destino: si soltamos sobre una card, su posición en la columna destino;
    // si sobre la columna (zona vacía / al final), va al final.
    let destIndex: number;
    if (overData?.type === 'task') {
      const overIndex = destTasks.findIndex((t) => t.id === overId);
      destIndex = overIndex === -1 ? destTasks.length : overIndex;
    } else {
      destIndex = destTasks.length;
    }

    // No-op: misma columna y misma posición efectiva.
    if (moved.columnId === destColumnId) {
      const currentIndex = (tasksByColumn.get(destColumnId) ?? []).findIndex(
        (t) => t.id === activeTaskId,
      );
      if (currentIndex === destIndex) return;
    }

    // (QL-63) ¿La tarea cruza a otra columna que es inicio/fin? El aviso es informativo y
    // NO bloqueante: el timing lo fija el backend igual; solo se muestra tras el move OK.
    const crossedColumn = moved.columnId !== destColumnId;
    const destColumn = crossedColumn
      ? columns?.find((c) => c.id === destColumnId)
      : undefined;

    moveTask.mutate(
      {
        id: activeTaskId,
        data: { columnId: destColumnId, order: destIndex },
      },
      {
        onSuccess: () => {
          if (!destColumn) return;
          if (destColumn.isStart) {
            toast.info(
              <span>
                Al mover a esta etapa se considera el <strong>inicio</strong> de la tarea.
              </span>,
            );
          } else if (destColumn.isEnd) {
            toast.info(
              <span>
                Al mover a esta etapa se considera que <strong>terminaste</strong> la tarea.
              </span>,
            );
          }
        },
      },
    );
  }

  return (
    <section className="mt-4">
      <div className="mb-4 flex items-center justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings2 className="size-4" />
          Configurar tablero
        </Button>
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-8 rounded-lg" />
              <Skeleton className="h-24 rounded-lg" />
              <Skeleton className="h-24 rounded-lg" />
            </div>
          ))}
        </div>
      )}

      {tasksError && !isLoading && (
        <div className="rounded-lg border border-error/20 bg-error-container px-4 py-3 text-sm font-medium text-on-error-container">
          {tasksErrorObj instanceof Error
            ? tasksErrorObj.message
            : 'No se pudieron cargar las tareas'}
        </div>
      )}

      {!isLoading && !tasksError && noColumns && (
        <div className="rounded-lg border border-dashed border-outline-variant/60 px-4 py-8 text-center text-sm text-on-surface-variant">
          <p>Crea al menos una columna de estado antes de añadir tareas.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 className="size-4" />
            Configurar tablero
          </Button>
        </div>
      )}

      {noFilterMatches && (
        <div className="rounded-lg border border-dashed border-outline-variant/60 px-4 py-8 text-center text-sm text-on-surface-variant">
          Ninguna tarea coincide con los filtros.
        </div>
      )}

      {!isLoading && !tasksError && !noColumns && !noFilterMatches && columns && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          {/* QL-36: cada columna ocupa el alto restante del viewport (topbar + cabecera del
              proyecto + tabs ≈ 15rem) y scrollea su lista de tarjetas por dentro; el board no
              genera doble scroll de página. El resto de vistas (List/Gantt/Planner) no usa
              esta grid, así que no se ven afectadas.
              QL-117: en móvil (< sm) las columnas van en scroll HORIZONTAL con snap, mostrando
              ~2 por "slide" (cada columna = 50% del ancho visible menos medio gap). En sm+ se
              mantiene la grid de escritorio intacta (snap/overflow desactivados). */}
          <div className="flex h-[calc(100dvh-15rem)] min-h-[24rem] snap-x snap-mandatory items-stretch gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:snap-none sm:overflow-x-visible sm:pb-0 lg:grid-cols-3 xl:grid-cols-4">
            {columns.map((column, index) => (
              <BoardColumn
                key={column.id}
                column={column}
                index={index}
                tasks={tasksByColumn.get(column.id) ?? []}
                onOpenTask={setOpenTaskId}
                onConfigure={() => setSettingsOpen(true)}
                onAddTask={openCreateForColumn}
              />
            ))}
          </div>

          <DragOverlay>
            {activeTask ? <TaskCard task={activeTask} onClick={() => {}} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      <TaskFormDialog
        open={createOpen}
        onOpenChange={handleCreateOpenChange}
        projectId={projectId}
        presetColumnId={presetColumnId}
      />
      <TaskDetailDialog
        taskId={openTaskId}
        projectId={projectId}
        onOpenChange={(o) => {
          if (!o) setOpenTaskId(null);
        }}
      />
      <BoardSettingsDialog
        projectId={projectId}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
    </section>
  );
}
