import { useCallback, useMemo } from 'react';

import { useQueryParams, useQueryParamState } from '@/shared/hooks/use-query-param-state';

import {
  isNotificationType,
  type NotificationListParams,
  type NotificationType,
} from '../services/notifications.service';

/**
 * Filtros de la bandeja (QL-137) **persistidos en la URL**: se comparten por enlace y
 * sobreviven a un recargo. Params: `estado` (`unread`), `tipo` (CSV), `proyecto`, `tarea`.
 *
 * ⚠️ REGLA QL-139 — **una acción del usuario = un solo `setParams`**. `setSearchParams` de
 * react-router no es una cola tipo `useState`: cada setter recomputa desde la URL del render
 * actual capturada en el closure y `navigate('?'+…)` reemplaza el search entero, así que dos
 * setters en el mismo handler se pisan (gana el segundo). Por eso TODOS los setters de aquí
 * escriben su parche completo en **una** llamada a `setParams` (ver `use-query-param-state.ts`).
 */

/** Estado de los filtros ya parseado desde la URL. */
export interface NotificationFilters {
  /** `true` = solo no leídas (pestaña "No leídas"). */
  unread: boolean;
  /** Tipos seleccionados (multi-selección). Vacío = todos. */
  types: NotificationType[];
  /** ObjectId del proyecto, o `null`. */
  projectId: string | null;
  /** ObjectId de la tarea, o `null`. */
  taskId: string | null;
}

export interface NotificationFiltersApi {
  filters: NotificationFilters;
  /** Filtros traducidos a los query params de `GET /notifications` (§3.36). */
  params: Omit<NotificationListParams, 'page'>;
  /** `true` si hay algún filtro de contenido activo (tipo/proyecto/tarea). */
  hasContentFilters: boolean;
  /** `true` si hay algo filtrado, incluida la pestaña "No leídas". */
  hasAnyFilter: boolean;
  setUnread: (next: boolean) => void;
  toggleType: (type: NotificationType) => void;
  setProject: (projectId: string | null) => void;
  setTask: (taskId: string | null) => void;
  clearAll: () => void;
}

export function useNotificationFilters(): NotificationFiltersApi {
  // Lectura: un `useQueryParamState` por param (sus setters NO se usan; ver la regla de arriba).
  const [estado] = useQueryParamState<string>('estado', 'all');
  const [tipoRaw] = useQueryParamState<string>('tipo', '');
  const [proyecto] = useQueryParamState<string>('proyecto', '');
  const [tarea] = useQueryParamState<string>('tarea', '');
  const setParams = useQueryParams();

  const types = useMemo(() => parseTypes(tipoRaw), [tipoRaw]);

  const filters = useMemo<NotificationFilters>(
    () => ({
      unread: estado === 'unread',
      types,
      projectId: proyecto || null,
      taskId: tarea || null,
    }),
    [estado, types, proyecto, tarea],
  );

  const params = useMemo<Omit<NotificationListParams, 'page'>>(
    () => ({
      unread: filters.unread || undefined,
      type: filters.types.length > 0 ? filters.types : undefined,
      projectId: filters.projectId ?? undefined,
      taskId: filters.taskId ?? undefined,
    }),
    [filters],
  );

  const setUnread = useCallback(
    (next: boolean) => {
      // `page: null` limpia la paginación heredada: la bandeja ahora es scroll infinito y un
      // `?page=3` de un enlace viejo solo sería ruido en la URL.
      setParams({ estado: next ? 'unread' : null, page: null });
    },
    [setParams],
  );

  const toggleType = useCallback(
    (type: NotificationType) => {
      const next = types.includes(type)
        ? types.filter((t) => t !== type)
        : [...types, type];
      setParams({ tipo: next.length > 0 ? next.join(',') : null, page: null });
    },
    [types, setParams],
  );

  const setProject = useCallback(
    (projectId: string | null) => {
      // Cambiar de proyecto invalida la tarea seleccionada (sería de otro proyecto): ambos
      // params viajan en el MISMO parche, no en dos setters encadenados.
      setParams({ proyecto: projectId, tarea: null, page: null });
    },
    [setParams],
  );

  const setTask = useCallback(
    (taskId: string | null) => setParams({ tarea: taskId, page: null }),
    [setParams],
  );

  const clearAll = useCallback(
    () => setParams({ estado: null, tipo: null, proyecto: null, tarea: null, page: null }),
    [setParams],
  );

  const hasContentFilters =
    filters.types.length > 0 || filters.projectId !== null || filters.taskId !== null;

  return {
    filters,
    params,
    hasContentFilters,
    hasAnyFilter: hasContentFilters || filters.unread,
    setUnread,
    toggleType,
    setProject,
    setTask,
    clearAll,
  };
}

/**
 * Parsea el CSV de `?tipo=` **descartando lo que no sea un tipo válido**. El backend valida cada
 * valor del CSV y responde **400** si uno no existe (§3.36): sanear aquí evita que una URL
 * compartida y toqueteada a mano tumbe la bandeja entera. También deduplica.
 */
function parseTypes(raw: string): NotificationType[] {
  if (!raw) return [];
  const seen = new Set<NotificationType>();
  for (const value of raw.split(',')) {
    const trimmed = value.trim();
    if (isNotificationType(trimmed)) seen.add(trimmed);
  }
  return [...seen];
}
