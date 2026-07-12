import { useQuery } from '@tanstack/react-query';

import { queryClient } from '@/core/query/query-client';
import { fetchAvatarObjectUrl } from '@/shared/services/avatar.service';

/**
 * Caché de blobs de imágenes adjuntas del muro (QL-90, §3.25.2). El binario se sirve por el
 * endpoint autenticado `GET /attachments/:id/download` (requiere `Authorization: Bearer`),
 * así que una `<img src>` desnuda no funciona: hay que hacer `fetch` con el token y crear un
 * `blob:` URL.
 *
 * **Reusa el fetch autenticado** de avatares (`fetchAvatarObjectUrl`, genérico: baja un
 * binario protegido → `blob:` URL, `null` en 404) para NO duplicar el fetch con token. Solo
 * añade aquí la capa de caché por `downloadUrl` (comparte un blob entre renders del mismo
 * adjunto) con su propia clave y revocación, análoga a `useAuthedAvatar`.
 */

const IMAGE_GC_TIME = 5 * 60_000; // 5 min: alineado con el Cache-Control del backend.

/** Clave de query estable por URL de descarga del adjunto. */
function wallImageKey(downloadUrl: string) {
  return ['wall-image-blob', downloadUrl] as const;
}

// Suscripción global (una sola vez): revoca el `blob:` URL al eliminarse su query del caché.
let subscribed = false;
function ensureRevokeSubscription() {
  if (subscribed) return;
  subscribed = true;
  queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'removed') return;
    const key = event.query.queryKey;
    if (!Array.isArray(key) || key[0] !== 'wall-image-blob') return;
    const url = event.query.state.data;
    if (typeof url === 'string' && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  });
}

/**
 * Devuelve el `blob:` URL de una imagen adjunta autenticada (o `null` si no hay URL / 404).
 * Cacheado por `downloadUrl`; `enabled` gatea la descarga (p. ej. solo cuando la imagen está
 * cerca del viewport, para respetar la carga perezosa).
 */
export function useWallImage(downloadUrl: string | undefined, enabled: boolean) {
  ensureRevokeSubscription();

  return useQuery({
    queryKey: wallImageKey(downloadUrl ?? ''),
    queryFn: () => fetchAvatarObjectUrl(downloadUrl as string),
    enabled: enabled && !!downloadUrl,
    staleTime: IMAGE_GC_TIME,
    gcTime: IMAGE_GC_TIME,
    retry: false,
  });
}
