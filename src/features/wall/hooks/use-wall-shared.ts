import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/store/auth.store';

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

/** Clave estable por tipo + página + tamaño (invalidación/caché consistente). */
function wallSharedKey(type: WallSharedType, page: number, limit: number) {
  return [...wallKeys.all, 'shared', type, page, limit] as const;
}

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
    queryKey: wallSharedKey(type, page, limit),
    queryFn: () => wallService.shared(type, page, limit),
    enabled: enabled && !!token,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}
