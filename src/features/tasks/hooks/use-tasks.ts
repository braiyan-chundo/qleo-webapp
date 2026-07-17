import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { ApiError } from '@/core/api/fetch-client';
import { SAFETY_NET_POLL_MS } from '@/core/query/query-client';

import {
  tasksService,
  type AssignRolePayload,
  type CompleteTaskPayload,
  type CreateTaskPayload,
  type MoveTaskPayload,
  type RequestDeadlineExtensionPayload,
  type SetDeadlinePayload,
  type Task,
  type UpdateTaskPayload,
} from '../services/tasks.service';

/**
 * Hooks de datos del feature Tareas (QL-07/QL-08). Toda la interacción con la API pasa por
 * aquí; los componentes usan estos hooks y nunca llaman al service ni manejan loading/error
 * a mano. Sigue el patrón de `features/columns/hooks/use-columns.ts`.
 */

/**
 * (QL-133) Sondeo del **estado de tiempo** de la tarea. NO usa `SAFETY_NET_POLL_MS` a propósito:
 * `workedMs` de una tarea en curso avanza con el **reloj**, no por un cambio que alguien haga, y
 * el bus `/realtime` solo difunde cambios. No hay ningún evento que despierte esta query, así
 * que bajarla a 60 s no la cubriría el tiempo real: solo haría que el contador saltara de minuto
 * en minuto. Se queda en la cadencia de siempre.
 */
const TIME_TICK_POLL_MS = 15_000;

/** Claves de query del feature. Centralizadas para invalidación consistente. */
export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (projectId: string) => [...taskKeys.lists(), projectId] as const,
  /** Tareas del usuario del token en todos los proyectos (pantalla "Mis tareas"). */
  mine: () => [...taskKeys.all, 'mine'] as const,
  details: () => [...taskKeys.all, 'detail'] as const,
  detail: (id: string) => [...taskKeys.details(), id] as const,
  /** Estado de tiempo (cronómetro, QL-17) de una tarea. */
  time: (id: string) => [...taskKeys.all, 'time', id] as const,
};

/**
 * Reproduce en cliente el reindex denso del server (QL-15) para el optimistic update:
 * quita la tarea de su posición actual, la inserta en `targetColumnId` en `targetIndex`
 * y recalcula `order` (0..n-1) por columna. Devuelve una lista nueva (no muta la entrada).
 */
function reorderTasksOptimistic(
  tasks: Task[],
  taskId: string,
  targetColumnId: string,
  targetIndex: number,
): Task[] {
  const moved = tasks.find((t) => t.id === taskId);
  if (!moved) return tasks;

  // Tareas de la columna destino (sin la movida), ordenadas por `order`.
  const destColumn = tasks
    .filter((t) => t.columnId === targetColumnId && t.id !== taskId)
    .sort((a, b) => a.order - b.order);

  const clampedIndex = Math.max(0, Math.min(targetIndex, destColumn.length));
  destColumn.splice(clampedIndex, 0, { ...moved, columnId: targetColumnId });

  // Reindexa densamente la columna destino.
  const reindexedDest = new Map<string, number>();
  destColumn.forEach((t, i) => reindexedDest.set(t.id, i));

  return tasks.map((t) => {
    if (t.id === taskId) {
      return { ...t, columnId: targetColumnId, order: reindexedDest.get(t.id) ?? t.order };
    }
    if (t.columnId === targetColumnId && reindexedDest.has(t.id)) {
      return { ...t, order: reindexedDest.get(t.id) as number };
    }
    return t;
  });
}

/** Lista de tareas del proyecto (ordenadas por `order` asc). No pagina. Sondea en vivo (P8). */
export function useTasks(projectId: string | undefined) {
  return useQuery({
    queryKey: taskKeys.list(projectId ?? ''),
    queryFn: () => tasksService.list({ projectId: projectId as string }),
    enabled: !!projectId,
    refetchInterval: SAFETY_NET_POLL_MS,
    refetchOnWindowFocus: true,
  });
}

/**
 * Tareas del usuario del token en todos los proyectos (pantalla "Mis tareas", §3.7).
 * Ya viene ordenado por `dueDate` asc (sin fecha al final); el filtrado extra es client-side.
 */
export function useMyTasks() {
  return useQuery({
    queryKey: taskKeys.mine(),
    queryFn: () => tasksService.listMine(),
    refetchInterval: SAFETY_NET_POLL_MS,
    refetchOnWindowFocus: true,
  });
}

/** Detalle de una tarea con `assignments[].user` poblado y `currentUserRole`. Sondea en vivo (P8). */
export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: taskKeys.detail(id ?? ''),
    queryFn: () => tasksService.getById(id as string),
    enabled: !!id,
    refetchInterval: SAFETY_NET_POLL_MS,
    refetchOnWindowFocus: true,
  });
}

/**
 * Crea una tarea e invalida el listado del proyecto. La respuesta del alta trae
 * `checklistDone`/`checklistTotal` a 0 y (QL-123) los roles iniciales ya poblados, pero se
 * invalida igual el listado: el board se repinta desde `GET /tasks` con los conteos y los
 * `assignments` reales (avatar del Responsable en la card) sin tocar la caché a mano.
 * También se invalida "Mis tareas": el creador siempre participa en la tarea recién creada.
 */
export function useCreateTask(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTaskPayload) => tasksService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.list(projectId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.mine() });
    },
  });
}

/** Edita una tarea (solo CREATOR) e invalida listado y detalle. */
export function useUpdateTask(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTaskPayload }) =>
      tasksService.update(id, data),
    onSuccess: (_task, { id }) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.list(projectId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(id) });
    },
  });
}

/** Variables de la mutación de move (identifican la tarea y el destino). */
interface MoveTaskVars {
  id: string;
  data: MoveTaskPayload;
}

/** Contexto entre `onMutate` y `onError` para poder revertir el optimistic update. */
interface MoveTaskContext {
  previous: Task[] | undefined;
}

/**
 * Mueve una tarea en el Kanban (QL-15, §3.7) con **actualización optimista**:
 * `onMutate` reordena la caché de `taskKeys.list(projectId)` al soltar (reproduciendo el
 * reindex denso del server); `onError` revierte al snapshot previo (y avisa si el rol es de
 * solo lectura, `err.code === 'READ_ONLY_ROLE'`); `onSettled` invalida el listado para
 * reconciliar con el reindex real del backend (que solo devuelve la tarea movida).
 */
export function useMoveTask(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation<Task, unknown, MoveTaskVars, MoveTaskContext>({
    mutationFn: ({ id, data }) => tasksService.move(id, data),
    onMutate: async ({ id, data }) => {
      const key = taskKeys.list(projectId);
      // Cancela refetches en vuelo para que no pisen el update optimista.
      await queryClient.cancelQueries({ queryKey: key });

      const previous = queryClient.getQueryData<Task[]>(key);
      if (previous) {
        queryClient.setQueryData<Task[]>(
          key,
          reorderTasksOptimistic(previous, id, data.columnId, data.order),
        );
      }
      return { previous };
    },
    onError: (err, _vars, context) => {
      // Revierte al snapshot previo.
      if (context?.previous) {
        queryClient.setQueryData(taskKeys.list(projectId), context.previous);
      }
      if (err instanceof ApiError && err.code === 'READ_ONLY_ROLE') {
        toast.error('Tu rol es de solo lectura');
        return;
      }
      toast.error(err instanceof Error ? err.message : 'No se pudo mover la tarea');
    },
    onSettled: () => {
      // Reconcilia con el reindex del server (que solo devuelve la tarea movida).
      queryClient.invalidateQueries({ queryKey: taskKeys.list(projectId) });
    },
  });
}

/** Elimina una tarea (solo CREATOR) e invalida listado y detalle. */
export function useDeleteTask(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => tasksService.remove(id),
    onSuccess: (_task, id) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.list(projectId) });
      queryClient.removeQueries({ queryKey: taskKeys.detail(id) });
    },
  });
}

/**
 * Asigna/cambia el rol por tarea de un usuario (solo CREATOR). Puede rechazar con `ApiError`
 * (`SINGLE_ASSIGNEE_REQUIRED` 409, `TASK_OWNERSHIP_REQUIRED` 403); el componente decide el
 * mensaje. Invalida listado (avatares/badges) y detalle.
 */
export function useAssignRole(projectId: string, taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AssignRolePayload) =>
      tasksService.assignRole(taskId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.list(projectId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
    },
  });
}

/** Quita a un usuario de la tarea (solo CREATOR; no al CREATOR). Invalida listado y detalle. */
export function useRemoveRole(projectId: string, taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => tasksService.removeRole(taskId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.list(projectId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
    },
  });
}

/**
 * Fija/cambia/quita la fecha límite y (des)bloquea su edición (QL-09, §3.7). Puede rechazar
 * con `ApiError` (`DEADLINE_LOCKED` 403 no-CREATOR con fecha bloqueada, `READ_ONLY_ROLE` 403
 * OBSERVER); el componente decide el mensaje. Invalida listado (badge de la card) y detalle.
 */
export function useSetDeadline(projectId: string, taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SetDeadlinePayload) => tasksService.setDeadline(taskId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.list(projectId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
    },
  });
}

/**
 * Solicita al Creador mover la fecha bloqueada (QL-09, §3.7). NO cambia la fecha: genera una
 * notificación al CREATOR. No invalida queries de tarea (nada cambia en la tarea). Puede
 * rechazar con `ApiError` (`READ_ONLY_ROLE`); el componente decide el mensaje.
 */
export function useRequestDeadlineExtension(taskId: string) {
  return useMutation({
    mutationFn: (data: RequestDeadlineExtensionPayload) =>
      tasksService.requestDeadlineExtension(taskId, data),
  });
}

/**
 * Estado de tiempo **automático** de la tarea (P4/§3.13). El tiempo hábil se fija solo al mover
 * la tarea entre las columnas `isStart`/`isEnd` (QL-62); no hay cronómetro manual. Sondea cada
 * ~15 s + al reenfocar (MVP = polling) para refrescar `workedMs` mientras está en curso.
 */
export function useTaskTime(taskId: string | undefined) {
  return useQuery({
    queryKey: taskKeys.time(taskId ?? ''),
    queryFn: () => tasksService.getTime(taskId as string),
    enabled: !!taskId,
    refetchOnMount: 'always',
    refetchInterval: TIME_TICK_POLL_MS,
    refetchOnWindowFocus: true,
  });
}

/**
 * Cierra la tarea con resumen (QL-17, RF-2.5, §3.13). Solo CREATOR/ASSIGNEE. Auto-detiene el
 * cronómetro del usuario, así que invalida también el estado de tiempo, además del listado
 * (badge "Completada" en board/lista) y el detalle. Puede rechazar con `ApiError`
 * (`MANDATORY_SUMMARY_REQUIRED` 400, `READ_ONLY_ROLE` 403); el componente decide el mensaje.
 */
export function useCompleteTask(projectId: string, taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CompleteTaskPayload) => tasksService.complete(taskId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.list(projectId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.time(taskId) });
    },
  });
}

/**
 * Reabre la tarea, limpiando el cierre (QL-17, §3.13). Solo CREATOR/ASSIGNEE. Invalida el
 * listado (badge "Completada") y el detalle. Puede rechazar con `ApiError` (`READ_ONLY_ROLE`
 * 403); el componente decide el mensaje.
 */
export function useReopenTask(projectId: string, taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => tasksService.reopen(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.list(projectId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
    },
  });
}
