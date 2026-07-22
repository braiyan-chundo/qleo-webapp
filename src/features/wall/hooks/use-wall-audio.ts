import { useQuery } from '@tanstack/react-query';

import { queryClient } from '@/core/query/query-client';
import { fetchAvatarObjectUrl } from '@/shared/services/avatar.service';

/**
 * Caché de blobs de **notas de voz** del muro (QL-104, §3.25.2). Igual que `useAttachmentBlob`: el
 * binario se sirve por `GET /attachments/:id/download` (requiere `Authorization: Bearer`), así
 * que un `<audio src>` desnudo no funciona; hay que hacer `fetch` con el token y crear un `blob:`
 * URL. Reusa el fetch autenticado genérico (`fetchAvatarObjectUrl`) y añade la caché por
 * `downloadUrl` con su propia clave y revocación. Se descarga **perezosamente** (`enabled`) para
 * no bajar todos los audios del feed hasta que el usuario pulse play.
 */

const AUDIO_GC_TIME = 5 * 60_000; // 5 min: alineado con el Cache-Control del backend.

function wallAudioKey(downloadUrl: string) {
  return ['wall-audio-blob', downloadUrl] as const;
}

// Suscripción global (una sola vez): revoca el `blob:` URL al eliminarse su query del caché.
let subscribed = false;
function ensureRevokeSubscription() {
  if (subscribed) return;
  subscribed = true;
  queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'removed') return;
    const key = event.query.queryKey;
    if (!Array.isArray(key) || key[0] !== 'wall-audio-blob') return;
    const url = event.query.state.data;
    if (typeof url === 'string' && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  });
}

/**
 * Devuelve el `blob:` URL de una nota de voz autenticada (o `null` si no hay URL / 404).
 * Cacheado por `downloadUrl`; `enabled` gatea la descarga (p. ej. solo al pulsar play).
 */
export function useWallAudio(downloadUrl: string | undefined, enabled: boolean) {
  ensureRevokeSubscription();

  return useQuery({
    queryKey: wallAudioKey(downloadUrl ?? ''),
    queryFn: () => fetchAvatarObjectUrl(downloadUrl as string),
    enabled: enabled && !!downloadUrl,
    staleTime: AUDIO_GC_TIME,
    gcTime: AUDIO_GC_TIME,
    retry: false,
  });
}
