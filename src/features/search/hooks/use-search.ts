import { useQuery } from '@tanstack/react-query';
import { searchService } from '../services/search.service';
import { useDebounce } from '@/shared/hooks/use-debounce';

/** Umbral mínimo de caracteres para consultar el backend (§3.16). */
export const SEARCH_MIN_CHARS = 2;

/** Claves de query del feature. */
export const searchKeys = {
  all: ['search'] as const,
  query: (q: string) => [...searchKeys.all, q] as const,
};

/**
 * Buscador global (QL-28, §3.16). Debounce ~250 ms sobre el término y solo consulta cuando
 * `q.trim().length >= 2` (evita la llamada por debajo del umbral, que el backend igual
 * devolvería vacía). El dato vive en la caché de TanStack Query.
 */
export function useGlobalSearch(rawTerm: string) {
  const debounced = useDebounce(rawTerm, 250);
  const q = debounced.trim();
  const enabled = q.length >= SEARCH_MIN_CHARS;

  const query = useQuery({
    queryKey: searchKeys.query(q),
    queryFn: () => searchService.search(q),
    enabled,
    staleTime: 30_000,
  });

  return {
    /** Término ya trimmeado que se está consultando. */
    term: q,
    /** `true` cuando el término supera el umbral (hay una consulta activa). */
    enabled,
    results: query.data,
    isLoading: enabled && query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}
