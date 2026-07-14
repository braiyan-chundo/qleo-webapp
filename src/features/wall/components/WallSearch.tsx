import { useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';

import { AuthedAvatar, identityAvatarFallback } from '@/shared/components/AuthedAvatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { useWallSearch } from '../hooks/use-wall-search';
import { formatWallShortDate, formatWallTime } from '../lib/wall-dates';
import { highlightTerm } from '../lib/wall-highlight';
import type { WallSearchResult } from '../types/wall.types';

interface WallSearchProps {
  /** Cierra el buscador y restaura el título del muro. */
  onClose: () => void;
  /** Salta al mensaje seleccionado (carga la ventana `around` + scroll + highlight). */
  onJump: (result: WallSearchResult) => void;
}

/**
 * Buscador inline del Muro Corporativo (QL-119, §3.29), estilo WhatsApp. Sustituye el título del
 * header por un input (autofocus) y despliega, mientras hay ≥2 chars, un **índice** de resultados
 * (avatar + nombre + extracto con el término resaltado + fecha). Al pulsar un resultado salta al
 * mensaje (`onJump`). Estado de UI **local** (el término y la query viven aquí / en TanStack Query).
 *
 * El panel se posiciona **absoluto** bajo el header (el `<header>` es `relative`); ancho acotado
 * al del header (`inset-x`) y alto máximo con scroll → no desborda en móvil (QL-105).
 */
export function WallSearch({ onClose, onJump }: WallSearchProps) {
  const [term, setTerm] = useState('');
  const { results, isLoading, isError, enabled, term: activeTerm } = useWallSearch(term);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {/* Input de búsqueda (reemplaza el bloque "Muro Corporativo"). */}
      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-outline-variant/60 bg-surface-container-low px-3 py-1.5 focus-within:border-primary/60">
        <Search className="size-4 shrink-0 text-on-surface-variant" aria-hidden />
        <input
          type="text"
          autoFocus
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              onClose();
            }
          }}
          placeholder="Buscar en el muro…"
          aria-label="Buscar mensajes del muro"
          className="min-w-0 flex-1 bg-transparent text-sm text-on-surface outline-none placeholder:text-on-surface-variant"
        />
        {term.length > 0 && (
          <button
            type="button"
            onClick={() => setTerm('')}
            aria-label="Limpiar búsqueda"
            className="shrink-0 text-on-surface-variant hover:text-on-surface"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Cerrar el buscador y volver al título. */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onClose}
        aria-label="Cerrar búsqueda"
        className="shrink-0 text-on-surface-variant"
      >
        <X className="size-5" />
      </Button>

      {/* Panel de resultados (índice tipo WhatsApp). Solo con término por encima del umbral. */}
      {enabled && (
        <div className="absolute inset-x-2 top-full z-20 mt-1 max-h-[60vh] overflow-y-auto rounded-xl border border-outline-variant/50 bg-surface shadow-lg md:inset-x-4">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-on-surface-variant">
              <Loader2 className="size-4 animate-spin" />
              Buscando…
            </div>
          ) : isError ? (
            <p className="px-4 py-6 text-center text-sm text-error">
              No se pudo completar la búsqueda.
            </p>
          ) : results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-on-surface-variant">
              Sin resultados para «{activeTerm}».
            </p>
          ) : (
            <ul className="flex flex-col py-1">
              {results.map((result) => (
                <li key={result.id}>
                  <WallSearchResultItem
                    result={result}
                    term={activeTerm}
                    onSelect={() => onJump(result)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

interface WallSearchResultItemProps {
  result: WallSearchResult;
  term: string;
  onSelect: () => void;
}

/** Una fila del índice de resultados: avatar + nombre + extracto (con término resaltado) + fecha. */
function WallSearchResultItem({ result, term, onSelect }: WallSearchResultItemProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full min-w-0 items-start gap-3 px-3 py-2.5 text-left transition-colors',
        'hover:bg-surface-container-low focus-visible:bg-surface-container-low focus-visible:outline-none',
      )}
    >
      <AuthedAvatar
        avatarDownloadUrl={result.authorAvatarUrl}
        name={result.authorName}
        className="size-9 shrink-0 border border-outline-variant/50"
        fallbackClassName={cn(identityAvatarFallback, 'text-xs')}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-semibold text-on-surface">
            {result.authorName}
          </span>
          <span
            className="shrink-0 text-[11px] text-on-surface-variant tabular-nums"
            title={formatWallTime(result.createdAt)}
          >
            {formatWallShortDate(result.createdAt)}
          </span>
        </div>
        <p className="line-clamp-2 text-xs text-on-surface-variant [overflow-wrap:anywhere]">
          {highlightTerm(result.snippet, term)}
        </p>
      </div>
    </button>
  );
}
