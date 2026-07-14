import { useQuery } from '@tanstack/react-query';

import { useDebounce } from '@/shared/hooks/use-debounce';

import { wallService } from '../services/wall.service';
import { wallKeys } from './use-wall';

/**
 * Umbral mínimo de caracteres útiles (tras trim) para consultar el backend (QL-119, §3.29): por
 * debajo el backend ya devolvería `[]`, así que ni disparamos la query.
 */
export const WALL_SEARCH_MIN_CHARS = 2;

/** Tamaño del índice de resultados (default del backend 20, máx 50). */
const WALL_SEARCH_LIMIT = 20;

/** Debounce del término (search-as-you-type sin martillear la API). */
const WALL_SEARCH_DEBOUNCE_MS = 300;

/**
 * Buscador del Muro Corporativo (QL-119, §3.29). Debounce ~300 ms sobre el término y solo
 * consulta cuando `q.trim().length >= 2` (search-as-you-type). El dato del servidor vive en la
 * caché de TanStack Query (clave estable por término); nunca fetch directo desde el componente.
 */
export function useWallSearch(rawTerm: string) {
  const debounced = useDebounce(rawTerm, WALL_SEARCH_DEBOUNCE_MS);
  const q = debounced.trim();
  const enabled = q.length >= WALL_SEARCH_MIN_CHARS;

  const query = useQuery({
    queryKey: [...wallKeys.search(), q] as const,
    queryFn: () => wallService.search(q, WALL_SEARCH_LIMIT),
    enabled,
    // El índice cambia poco durante una búsqueda; evita refetch agresivo al reenfocar.
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  return {
    /** Término ya trimmeado que se está consultando. */
    term: q,
    /** `true` cuando el término supera el umbral (hay una consulta activa). */
    enabled,
    results: query.data ?? [],
    isLoading: enabled && query.isLoading,
    isError: query.isError,
  };
}
