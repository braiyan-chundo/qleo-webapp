import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query';

import { attachmentKeys } from '@/features/attachments/hooks/use-attachments';
import { checklistKeys } from '@/features/checklists/hooks/use-checklist';
import { columnKeys } from '@/features/columns/hooks/use-columns';
import { commentKeys } from '@/features/comments/hooks/use-comments';
import { dashboardKeys } from '@/features/dashboard/hooks/use-my-dashboard';
import { notificationKeys } from '@/features/notifications/hooks/use-notifications';
import { projectKeys } from '@/features/projects/hooks/use-projects';
import { taskKeys } from '@/features/tasks/hooks/use-tasks';
import { wallSharedKeys } from '@/features/wall/hooks/use-wall-shared';
import { wallKeys } from '@/features/wall/hooks/use-wall';

import type { RealtimeEvent } from '../types/realtime.types';

/**
 * Traduce los `realtime:event` del bus (QL-133, §3.37) a invalidaciones de TanStack Query.
 *
 * Este hook es el **único** punto donde el socket toca la caché: recibe metadatos y decide qué
 * keys re-pedir. No escribe datos en la caché (D1) — quien re-pide es cada hook por HTTP, así
 * que la matriz de permisos sigue viviendo solo en el backend.
 */

/**
 * Ventana de agrupación (D8). Reordenar 10 columnas emite 10 eventos; sin agrupar serían 10
 * tormentas de refetch. Se acumulan las keys de la ráfaga y **cada una se invalida una sola vez**.
 *
 * Es un *throttle* con descarga final (no un debounce): el timer arranca con el primer evento y
 * NO se reinicia con los siguientes, así una ráfaga continua se descarga cada ~150 ms en vez de
 * quedar aplazada indefinidamente.
 */
const FLUSH_WINDOW_MS = 150;

/**
 * Keys a invalidar para un evento. Devuelve `[]` si al evento le faltan los ids necesarios
 * (p. ej. un `column` sin `projectId`): mejor no hacer nada que invalidar a ciegas.
 *
 * Necesita el `queryClient` solo para inspeccionar el feed del muro (ver el caso `wall`).
 */
function keysForEvent(event: RealtimeEvent, queryClient: QueryClient): QueryKey[] {
  const { entity, projectId, taskId, id } = event;

  switch (entity) {
    case 'project': {
      // Para `entity: 'project'` la entidad que cambió ES el proyecto. Se prefiere `projectId`,
      // pero se cae a `id` por si el alta (`POST /projects`, sin `:projectId` en la ruta) lo
      // manda null: así el detalle del proyecto recién creado también se refresca.
      const pid = projectId ?? id;
      if (!pid) return [projectKeys.lists()];
      return [projectKeys.lists(), projectKeys.detail(pid), projectKeys.members(pid)];
    }

    case 'column': {
      // Borrar una columna reubica/elimina sus tareas → el tablero se re-pide entero.
      if (!projectId) return [];
      return [columnKeys.list(projectId), taskKeys.list(projectId)];
    }

    case 'task': {
      const keys: QueryKey[] = [taskKeys.mine(), dashboardKeys.all];
      if (projectId) keys.push(taskKeys.list(projectId));
      // En `task` el id de la tarea es `id`; `taskId` se usa si viene (sub-recursos como
      // `/tasks/:taskId/complete`), que es donde `id` podría no ser el de la tarea.
      const tid = taskId ?? id;
      if (tid) keys.push(taskKeys.detail(tid));
      return keys;
    }

    case 'comment': {
      if (!taskId) return [];
      return [commentKeys.list(taskId)];
    }

    case 'checklist': {
      if (!taskId) return [];
      // Además del checklist: la card del tablero y el detalle pintan los contadores
      // `checklistDone`/`checklistTotal`, que salen de `GET /tasks`, no de `GET /checklist`.
      // Sin esto el badge "2/5" de la card se quedaría congelado hasta el siguiente poll.
      const keys: QueryKey[] = [checklistKeys.list(taskId), taskKeys.detail(taskId)];
      if (projectId) keys.push(taskKeys.list(projectId));
      return keys;
    }

    case 'attachment': {
      const keys: QueryKey[] = [];
      if (taskId) keys.push(attachmentKeys.list(taskId));
      if (projectId) keys.push(attachmentKeys.projectList(projectId));
      // Sin ids no se puede afinar: se invalida el feature entero antes que ignorar el evento.
      return keys.length > 0 ? keys : [attachmentKeys.all];
    }

    case 'wall': {
      // `wallKeys.all` NO se usa a propósito: arrastraría `feed()` y `presence()`.
      // - `presence()` la sirve el socket `/presence`, refetcharla es puro gasto.
      // - `feed()` es una caché **gestionada a mano** (`staleTime: Infinity`; historial y ventana
      //   `around` mezclados con `setQueryData`). Invalidarla recargaría solo la página más nueva
      //   y **destruiría** el historial cargado o el salto a un mensaje (QL-119): un usuario que
      //   saltó a un mensaje viejo se vería arrastrado al presente por un mensaje ajeno.
      // La vía correcta es `poll()`: pide `after=<cursor>` y **mezcla** sobre el feed.
      // `wallSharedKeys.all()` cuelga de `wallKeys.all`, así que va explícita (QL-136).
      const keys: QueryKey[] = [
        wallKeys.unreadCount(),
        wallKeys.pinned(),
        wallSharedKeys.all(),
      ];
      // Excepción: con el feed vacío no hay cursor del que tirar (`poll` saldría sin pedir nada)
      // y tampoco hay historial que perder → ahí sí se invalida `feed()`.
      const feed = queryClient.getQueryData<unknown[]>(wallKeys.feed());
      keys.push(feed && feed.length > 0 ? wallKeys.poll() : wallKeys.feed());
      return keys;
    }

    case 'notification': {
      // `all` es prefijo de `lists()`, `feeds()` (bandeja infinita, QL-137), `facets()` y
      // `unreadCount()`: una sola invalidación cubre badge, campana, bandeja y contadores.
      return [notificationKeys.all];
    }

    default: {
      // Entidad desconocida (backend más nuevo que este front): ignorar, no romper.
      return [];
    }
  }
}

/**
 * Devuelve un `enqueue(event)` que acumula las keys del evento y las invalida agrupadas.
 * Los timers se limpian al desmontar.
 */
export function useRealtimeInvalidation(): (event: RealtimeEvent) => void {
  const queryClient = useQueryClient();
  /** Keys pendientes de la ráfaga, deduplicadas por su serialización. */
  const pendingRef = useRef(new Map<string, QueryKey>());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    timerRef.current = null;
    const keys = [...pendingRef.current.values()];
    pendingRef.current.clear();
    for (const queryKey of keys) {
      void queryClient.invalidateQueries({ queryKey });
    }
  }, [queryClient]);

  const enqueue = useCallback(
    (event: RealtimeEvent) => {
      for (const key of keysForEvent(event, queryClient)) {
        // Las keys son arrays de strings/objetos serializables: `JSON.stringify` basta para
        // deduplicar sin invalidar dos veces la misma.
        pendingRef.current.set(JSON.stringify(key), key);
      }
      if (pendingRef.current.size > 0 && !timerRef.current) {
        timerRef.current = setTimeout(flush, FLUSH_WINDOW_MS);
      }
    },
    [flush, queryClient],
  );

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    },
    [],
  );

  return enqueue;
}
