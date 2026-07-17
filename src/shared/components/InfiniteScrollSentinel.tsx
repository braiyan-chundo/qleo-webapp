import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

interface InfiniteScrollSentinelProps {
  /** ¿Queda otra página? Si no, el centinela no se pinta (y no observa nada). */
  hasNextPage: boolean;
  /** `true` mientras se trae la siguiente página (evita disparar dos veces). */
  isFetchingNextPage: boolean;
  /** El `fetchNextPage` de la `useInfiniteQuery` del llamador. */
  onLoadMore: () => void;
}

/**
 * Centinela de **scroll infinito**: un elemento vacío al final de la lista que, al entrar en el
 * viewport, pide la siguiente página. Va con `useInfiniteQuery` (el estado del servidor sigue
 * viviendo en la caché de TanStack Query; esto solo decide *cuándo* pedir).
 *
 * Se apoya en `IntersectionObserver` en vez de en un handler de `scroll` porque no asume quién
 * es el contenedor scrolleable (la página o un ancestro): el observer usa el viewport y funciona
 * igual en ambos casos. `rootMargin` precarga un poco antes de tocar el final, para que el
 * scroll no llegue a frenarse.
 */
export function InfiniteScrollSentinel({
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: InfiniteScrollSentinelProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // `onLoadMore` es `fetchNextPage`: ya es idempotente mientras hay una en vuelo, pero
        // el guard evita encolar peticiones si el centinela parpadea al entrar/salir.
        if (entries[0]?.isIntersecting && !isFetchingNextPage) onLoadMore();
      },
      { rootMargin: '200px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, onLoadMore]);

  if (!hasNextPage) return null;

  return (
    <div ref={ref} className="flex justify-center py-4" aria-hidden={!isFetchingNextPage}>
      {isFetchingNextPage && (
        <Loader2 className="size-4 animate-spin text-on-surface-variant" />
      )}
    </div>
  );
}
