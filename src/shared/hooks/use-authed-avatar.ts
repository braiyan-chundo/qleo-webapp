import { useQuery, useQueryClient } from '@tanstack/react-query';

import { queryClient } from '@/core/query/query-client';
import { fetchAvatarObjectUrl } from '@/shared/services/avatar.service';

/**
 * Caché de blobs de avatar (QL-32, §3.15).
 *
 * El binario del avatar se sirve por un proxy autenticado, así que hay que hacer `fetch`
 * con token y crear un `blob:` URL. Cacheamos el resultado con TanStack Query **por
 * `downloadUrl`** para no re-descargar en cada render (muchos `AuthedAvatar` con la misma
 * URL comparten un solo blob).
 *
 * Fugas de memoria: un `blob:` URL vive hasta que se **revoca**. Como varias instancias
 * comparten la misma entrada de caché, no podemos revocar al desmontar un componente (eso
 * rompería a los demás). En su lugar, un suscriptor global de la caché revoca el object URL
 * cuando su query se **elimina** (tras `gcTime`), que es el único momento seguro.
 */

// (QL-182, §3.60) Se queda en **5 min a propósito**, aunque el backend cachee la imagen 24 h.
// Este `gcTime` gobierna cuánto vive el `blob:` (bytes de la imagen) en RAM; la persistencia de 1
// día la da ahora el Service Worker (caché `qleo-images-v1`), no la memoria. Subirlo a 24 h
// retendría TODOS los blobs de avatar en RAM un día entero sin ganar nada: el SW ya sirve la
// imagen sin red, y este caché solo evita re-crear el `blob:` durante una sesión activa.
const AVATAR_GC_TIME = 5 * 60_000;

/**
 * Clave de query estable por URL de descarga del avatar.
 *
 * (QL-182) La `downloadUrl` llega **versionada** (`…/avatar?v=<hash>`) y se usa **tal cual**,
 * con el query incluido: eso es lo que hace que cambiar la foto invalide esta entrada por sí
 * sola (nueva URL → nueva clave → nuevo fetch). No recortar ni normalizar la URL.
 */
export function avatarQueryKey(downloadUrl: string) {
  return ['avatar-blob', downloadUrl] as const;
}

// Suscripción global (una sola vez): revoca el `blob:` URL al eliminarse su query del caché.
let subscribed = false;
function ensureRevokeSubscription() {
  if (subscribed) return;
  subscribed = true;
  queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'removed') return;
    const key = event.query.queryKey;
    if (!Array.isArray(key) || key[0] !== 'avatar-blob') return;
    const url = event.query.state.data;
    if (typeof url === 'string' && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  });
}

/**
 * Devuelve el `blob:` URL del avatar autenticado (o `null` en 404 / sin URL). Cacheado por
 * `downloadUrl`; deshabilitado si no hay URL (para caer directo al fallback externo/iniciales).
 */
export function useAuthedAvatar(downloadUrl: string | null | undefined) {
  ensureRevokeSubscription();

  return useQuery({
    queryKey: avatarQueryKey(downloadUrl ?? ''),
    queryFn: () => fetchAvatarObjectUrl(downloadUrl as string),
    enabled: !!downloadUrl,
    staleTime: AVATAR_GC_TIME,
    gcTime: AVATAR_GC_TIME,
    retry: false,
  });
}

/**
 * Invalida y elimina el blob cacheado de un avatar concreto (tras subir/quitar la foto),
 * para forzar una nueva descarga y reflejar el cambio al instante. Devuelve una función lista
 * para usar dentro de `onSuccess` de una mutación.
 */
export function useResetAvatarCache() {
  const client = useQueryClient();
  return (downloadUrl: string | null | undefined) => {
    // Elimina la entrada (revoca el blob viejo vía el suscriptor global) y limpia también
    // cualquier avatar del mismo usuario cuya URL haya cambiado (ETag/updatedAt).
    if (downloadUrl) {
      client.removeQueries({ queryKey: avatarQueryKey(downloadUrl), exact: true });
    }
    client.invalidateQueries({ queryKey: ['avatar-blob'] });
  };
}
