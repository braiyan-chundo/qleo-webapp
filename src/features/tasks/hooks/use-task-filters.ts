import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  useQueryParams,
  useQueryParamSearch,
  useQueryParamState,
} from '@/shared/hooks/use-query-param-state';
import { useAuthStore } from '@/store/auth.store';

import type { Task, TaskAssignment } from '../services/tasks.service';

/** Filtro por estado de cierre de la tarea, compartido por las vistas del board. */
export type TaskStatusFilter = 'all' | 'active' | 'completed';

/** Valor sentinela para "todos" en un select (los ids reales nunca son vacíos). */
const ALL = '';

/**
 * Claves de los query params de estos filtros. Constantes (y no literales sueltos) porque
 * `clear()` las necesita para el parche por lotes: si el `useQueryParamState` y el `clear`
 * se desincronizaran, "Limpiar filtros" dejaría de limpiar sin que nada fallara.
 */
const SEARCH_PARAM = 'q';
const ASSIGNEE_PARAM = 'resp';
const STATUS_PARAM = 'estado';

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
 *
 * QL-156: por defecto el filtro de Responsable arranca preseleccionado al **usuario actual**
 * (lo más común es "ver mis tareas"). Es solo el valor inicial: el usuario puede cambiarlo o
 * elegir "Todos". Se respeta el deep-link — si la URL ya trae `resp` (incluso vacío), no se
 * pisa; el default solo aplica cuando el param está **ausente** al montar.
 */
export function useTaskFilters(tasks: Task[] | undefined): UseTaskFiltersResult {
  const { value: searchValue, setValue: setSearchValue, committed } =
    useQueryParamSearch(SEARCH_PARAM, 300);
  const [assigneeId, setAssigneeId] = useQueryParamState<string>(ASSIGNEE_PARAM, ALL);
  const [status, setStatus] = useQueryParamState<TaskStatusFilter>(STATUS_PARAM, 'all');
  const setParams = useQueryParams();

  const currentUserId = useAuthStore((s) => s.user?.id);
  const currentUserName = useAuthStore((s) => s.user?.name);
  const [urlParams] = useSearchParams();

  /**
   * Preselección one-shot del Responsable = usuario actual (QL-156). Solo si el `resp` está
   * ausente en la URL al montar (deep-link con filtro → se respeta) y ya conocemos la sesión.
   * El ref evita reaplicarlo cuando el usuario elige "Todos" o limpia (que dejan el param
   * ausente): no queremos que "me" reaparezca solo.
   */
  const didInitAssignee = useRef(false);
  useEffect(() => {
    if (didInitAssignee.current) return;
    if (!currentUserId) return; // esperamos a tener sesión resuelta
    didInitAssignee.current = true;
    if (!urlParams.has(ASSIGNEE_PARAM)) {
      setAssigneeId(currentUserId);
    }
  }, [currentUserId, urlParams, setAssigneeId]);

  const search = committed.toLowerCase();

  const assigneeOptions = useMemo<AssigneeOption[]>(() => {
    const map = new Map<string, string>();
    tasks?.forEach((task) => {
      const assignee = assigneeOf(task);
      if (assignee) {
        map.set(assignee.userId, assignee.user?.name ?? assignee.userId);
      }
    });
    // El usuario actual siempre debe poder seleccionarse (es el default): garantiza que la
    // opción exista aunque todavía no sea responsable de ninguna tarea del proyecto, para que
    // el select muestre correctamente "yo" en vez de caer al primer option.
    if (currentUserId && !map.has(currentUserId)) {
      map.set(currentUserId, currentUserName ?? currentUserId);
    }
    return [...map.entries()]
      .map(([userId, name]) => ({ userId, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [tasks, currentUserId, currentUserName]);

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

  /**
   * Limpia todos los filtros. Los params de la URL se quitan en **un solo** `setParams`
   * (QL-139): con setters encadenados el último ganaba y dejaba `resp` pegado, porque todos
   * computaban desde la URL del render actual. Ver `useQueryParams`.
   *
   * `setSearchValue('')` sí va aparte a propósito: `useQueryParamSearch` solo toca estado
   * local y escribe `q` más tarde, en su efecto con debounce (otro tick, ya con la URL
   * actualizada), así que no compite con este parche.
   */
  const clear = useCallback(() => {
    setSearchValue('');
    // `null` = quitar el param; para estos dos, ausente == su valor por defecto.
    setParams({ [ASSIGNEE_PARAM]: null, [STATUS_PARAM]: null });
  }, [setSearchValue, setParams]);

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
