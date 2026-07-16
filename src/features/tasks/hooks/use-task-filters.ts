import { useCallback, useMemo } from 'react';

import {
  useQueryParamSearch,
  useQueryParamState,
} from '@/shared/hooks/use-query-param-state';

import type { Task, TaskAssignment } from '../services/tasks.service';

/** Filtro por estado de cierre de la tarea, compartido por las vistas del board. */
export type TaskStatusFilter = 'all' | 'active' | 'completed';

/** Valor sentinela para "todos" en un select (los ids reales nunca son vacíos). */
const ALL = '';

/** El ASSIGNEE (Responsable único, RF-1.2) de una tarea, si existe. */
function assigneeOf(task: Task): TaskAssignment | undefined {
  return task.assignments.find((a) => a.role === 'ASSIGNEE');
}

/** Estado de los filtros del board, ya persistido en la URL. */
export interface TaskFiltersState {
  /** Texto en vivo del input de búsqueda (bindear al value del Input). */
  searchValue: string;
  /** Setter del texto en vivo de búsqueda. */
  setSearchValue: (value: string) => void;
  /** Responsable seleccionado (userId) o `''` para todos. */
  assigneeId: string;
  setAssigneeId: (value: string) => void;
  /** Estado de cierre seleccionado. */
  status: TaskStatusFilter;
  setStatus: (value: TaskStatusFilter) => void;
}

/** Opciones de responsable derivadas de las tareas del proyecto. */
export interface AssigneeOption {
  userId: string;
  name: string;
}

export interface UseTaskFiltersResult extends TaskFiltersState {
  /** Aplica todos los filtros (AND) a una lista de tareas. Estable por referencia. */
  filter: (tasks: Task[]) => Task[];
  /** Nº de filtros activos (para el badge del botón "Filtrar"). */
  activeCount: number;
  /** `true` si hay algún filtro activo. */
  hasActiveFilters: boolean;
  /** Limpia todos los filtros a su valor por defecto. */
  clear: () => void;
  /** Responsables presentes en las tareas dadas (para poblar el select). */
  assigneeOptions: AssigneeOption[];
}

/**
 * Filtros del tablero de tareas (QL-07/QL-16), reutilizables entre todas las vistas
 * (Kanban/List/Gantt/Planner). El estado vive en **query params** (persistente al recargar
 * y compartible) vía {@link useQueryParamState}; no es dato de servidor.
 *
 * Filtra por: búsqueda de título, responsable (ASSIGNEE) y estado de cierre.
 * `tasks` se usa solo para derivar las opciones de responsable; el filtrado se aplica con
 * `filter(tasks)` en el punto que corresponda para no duplicar lógica.
 *
 * Nombres de param (cortos y consistentes): `q`, `resp`, `estado`.
 */
export function useTaskFilters(tasks: Task[] | undefined): UseTaskFiltersResult {
  const { value: searchValue, setValue: setSearchValue, committed } =
    useQueryParamSearch('q', 300);
  const [assigneeId, setAssigneeId] = useQueryParamState<string>('resp', ALL);
  const [status, setStatus] = useQueryParamState<TaskStatusFilter>('estado', 'all');

  const search = committed.toLowerCase();

  const assigneeOptions = useMemo<AssigneeOption[]>(() => {
    const map = new Map<string, string>();
    tasks?.forEach((task) => {
      const assignee = assigneeOf(task);
      if (assignee) {
        map.set(assignee.userId, assignee.user?.name ?? assignee.userId);
      }
    });
    return [...map.entries()]
      .map(([userId, name]) => ({ userId, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [tasks]);

  const filter = useCallback(
    (input: Task[]): Task[] =>
      input.filter((task) => {
        if (search && !task.title.toLowerCase().includes(search)) return false;
        if (assigneeId && assigneeOf(task)?.userId !== assigneeId) return false;
        if (status === 'active' && task.isCompleted) return false;
        if (status === 'completed' && !task.isCompleted) return false;
        return true;
      }),
    [search, assigneeId, status],
  );

  const activeCount =
    (search ? 1 : 0) +
    (assigneeId ? 1 : 0) +
    (status !== 'all' ? 1 : 0);

  const clear = useCallback(() => {
    setSearchValue('');
    setAssigneeId(ALL);
    setStatus('all');
  }, [setSearchValue, setAssigneeId, setStatus]);

  return {
    searchValue,
    setSearchValue,
    assigneeId,
    setAssigneeId,
    status,
    setStatus,
    filter,
    activeCount,
    hasActiveFilters: activeCount > 0,
    clear,
    assigneeOptions,
  };
}
