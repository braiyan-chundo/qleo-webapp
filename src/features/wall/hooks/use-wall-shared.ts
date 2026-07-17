import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/store/auth.store';
import {
  attachmentsService,
  type Attachment,
} from '@/features/attachments/services/attachments.service';

import { wallService } from '../services/wall.service';
import { wallKeys } from './use-wall';
import type { WallSharedType } from '../types/wall-shared.types';

/**
 * Datos de la galería "Archivos compartidos" del Muro (QL-96, §3.28). Todo el estado del
 * servidor vive en la caché de TanStack Query; la paginación es **por página** (no scroll
 * infinito), así que la clave incluye `type` + `page` + `limit`.
 *
 * `keepPreviousData` evita el parpadeo al cambiar de página en el modal "Ver todos" (la lista
 * previa se mantiene mientras llega la nueva). El panel del aside solo pide la **primera página**.
 */

/** Tamaño de página del panel del aside (galería acotada). §3.28 sugiere 12–20. */
export const SHARED_PANEL_LIMIT = 12;
/** Tamaño de página del modal "Ver todos" (más ancho, paginado). Máx del backend: 50. */
export const SHARED_DIALOG_LIMIT = 24;

/**
 * Claves de la galería. `all()` es el **prefijo** de las tres pestañas y todas sus páginas:
 * borrar un adjunto invalida por ahí (el item puede estar en cualquier página cacheada).
 */
export const wallSharedKeys = {
  all: () => [...wallKeys.all, 'shared'] as const,
  page: (type: WallSharedType, page: number, limit: number) =>
    [...wallSharedKeys.all(), type, page, limit] as const,
};

/**
 * Una página de la galería de un `type`. `enabled` gatea la petición (p. ej. solo la pestaña
 * activa del panel, o solo cuando el modal está abierto), evitando descargar los tres tipos a la vez.
 */
export function useWallShared(
  type: WallSharedType,
  page = 1,
  limit: number = SHARED_PANEL_LIMIT,
  enabled = true,
) {
  const token = useAuthStore((s) => s.accessToken);

  return useQuery({
    queryKey: wallSharedKeys.page(type, page, limit),
    queryFn: () => wallService.shared(type, page, limit),
    enabled: enabled && !!token,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

/**
 * Borra un adjunto del muro desde "Archivos compartidos" (QL-136, §3.35). Reusa el
 * `DELETE /attachments/:id` de siempre — que ya borra el binario de Nextcloud — pero ahora el
 * backend además hace `$pull` del id en el mensaje y, **si el mensaje se queda sin body y sin
 * adjuntos, lo convierte en lápida** (`deleted:true`).
 *
 * Por eso NO basta con invalidar la galería: hay que invalidar también el **feed** (el mensaje
 * puede haber perdido un adjunto o haberse vuelto "Este mensaje fue eliminado") y el panel de
 * **fijados** (pinta los mismos mensajes expandidos). El `DELETE` devuelve el `Attachment`
 * borrado, no el mensaje resultante, así que no hay forma de reconciliar la caché a mano sin
 * duplicar en el front la regla de la lápida: invalidar es lo honesto.
 *
 * Ojo (aceptado): `wallKeys.feed()` tiene `staleTime: Infinity` y ventana gestionada a mano, así
 * que su refetch **reencuadra el feed en los 30 mensajes más recientes**. Si el usuario había
 * cargado historial, lo pierde. Es una acción rara y la alternativa (mentir con un adjunto que
 * ya no existe) es peor.
 */
export function useDeleteSharedAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (attachment: Attachment) => attachmentsService.remove(attachment.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: wallSharedKeys.all() });
      queryClient.invalidateQueries({ queryKey: wallKeys.feed() });
      queryClient.invalidateQueries({ queryKey: wallKeys.pinned() });
    },
  });
}
