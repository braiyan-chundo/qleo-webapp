import { useQuery } from '@tanstack/react-query';

import { queryClient } from '@/core/query/query-client';
import { fetchAvatarObjectUrl } from '@/shared/services/avatar.service';

/**
 * Caché de blobs de **adjuntos** protegidos (§3.11/§3.25.2). El binario se sirve por el endpoint
 * autenticado `GET /attachments/:id/download` (requiere `Authorization: Bearer`), así que una
 * `<img src>`/`<video src>`/`<iframe src>` desnuda no funciona: hay que hacer `fetch` con el token
 * y crear un `blob:` URL.
 *
 * (QL-174) Nació en el muro como `useWallImage`; se movió aquí —el feature dueño de los
 * adjuntos— al generalizarse el visor para muro **y** comentarios de tarea. Consumidores:
 * `AttachmentViewer`, `WallImage`, `WallSharedThumb`.
 *
 * **Reusa el fetch autenticado** de avatares (`fetchAvatarObjectUrl`, genérico: baja un binario
 * protegido → `blob:` URL, `null` en 404) para NO duplicar el fetch con token. Solo añade aquí la
 * capa de caché por `downloadUrl` (comparte un blob entre renders del mismo adjunto) con su propia
 * clave y revocación, análoga a `useAuthedAvatar`.
 */

// (QL-182, §3.60) Se queda en **5 min a propósito**, aunque el backend cachee el binario 24 h.
// Este `gcTime` gobierna cuánto vive el `blob:` (bytes del adjunto) en RAM; la persistencia de 1
// día la da el Service Worker (caché `qleo-images-v1`, solo imágenes bajo el techo de tamaño),
// no la memoria. Subirlo retendría todos los blobs de adjunto en RAM 24 h sin ganar nada.
const BLOB_GC_TIME = 5 * 60_000;

/** Prefijo de la clave de caché; también lo usa la suscripción que revoca los `blob:` URL. */
const BLOB_KEY_PREFIX = 'attachment-blob';

/** Clave de query estable por URL de descarga del adjunto. */
function attachmentBlobKey(downloadUrl: string) {
  return [BLOB_KEY_PREFIX, downloadUrl] as const;
}

// Suscripción global (una sola vez): revoca el `blob:` URL al eliminarse su query del caché.
let subscribed = false;
function ensureRevokeSubscription() {
  if (subscribed) return;
  subscribed = true;
  queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'removed') return;
    const key = event.query.queryKey;
    if (!Array.isArray(key) || key[0] !== BLOB_KEY_PREFIX) return;
    const url = event.query.state.data;
    if (typeof url === 'string' && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  });
}

/**
 * Devuelve el `blob:` URL de un adjunto autenticado (o `null` si no hay URL / 404). Cacheado por
 * `downloadUrl`; `enabled` gatea la descarga (p. ej. solo cuando la imagen está cerca del
 * viewport, para respetar la carga perezosa).
 */
export function useAttachmentBlob(downloadUrl: string | undefined, enabled: boolean) {
  ensureRevokeSubscription();

  return useQuery({
    queryKey: attachmentBlobKey(downloadUrl ?? ''),
    queryFn: () => fetchAvatarObjectUrl(downloadUrl as string),
    enabled: enabled && !!downloadUrl,
    staleTime: BLOB_GC_TIME,
    gcTime: BLOB_GC_TIME,
    retry: false,
  });
}
