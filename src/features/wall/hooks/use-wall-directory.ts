import { useCallback } from 'react';

import { useUserDirectory } from '@/features/users/hooks/use-users';
import type { CommentMention } from '@/features/comments/services/comments.service';

/**
 * Resuelve los `mentions` de un mensaje del muro (que son solo **userIds**, §3.25) a menciones
 * pobladas `{ id, name }`. A diferencia de los comentarios —donde el backend puebla el nombre—
 * el muro solo guarda los ids, así que el front los cruza con el **directorio** (`/users/directory`,
 * hasta 50 usuarios activos) para poder resaltar `@Nombre` en el hilo y sembrar el editor.
 *
 * Reusa `useUserDirectory('')` (query compartida y cacheada por TanStack Query, sin N+1). Se
 * activa solo cuando hace falta (`enabled`), para no cargar el directorio si no hay menciones.
 */
export function useWallDirectory(enabled: boolean) {
  const { data } = useUserDirectory('', { enabled });

  const resolve = useCallback(
    (ids: string[]): CommentMention[] => {
      if (!data || ids.length === 0) return [];
      return ids
        .map((id) => data.find((u) => u.id === id))
        .filter((u): u is NonNullable<typeof u> => !!u)
        .map((u) => ({ id: u.id, name: u.name }));
    },
    [data],
  );

  return { resolve };
}
