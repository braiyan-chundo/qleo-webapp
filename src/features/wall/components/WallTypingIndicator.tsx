import { Mic } from 'lucide-react';

import { useWallTypers } from '../hooks/use-wall-presence';
import type { WallTyper } from '../types/wall.types';

/**
 * Indicador efímero "escribiendo…/grabando audio…" del Muro (QL-125), estilo WhatsApp. Lee la
 * lista de typers del socket único (`WallPresenceProvider`) y la resume en una línea. No aparece
 * cuando nadie escribe (el server envía `{ typers: [] }`); no depende del backend de typing para
 * no romper nada si aún no está desplegado.
 */

/** Resume el conjunto de typers en un texto + si el icono debe ser de audio (micro) o de puntos. */
function describeTypers(typers: WallTyper[]): { label: string; audio: boolean } | null {
  const n = typers.length;
  if (n === 0) return null;

  const allAudio = typers.every((t) => t.kind === 'audio');

  if (n === 1) {
    const { name } = typers[0];
    return allAudio
      ? { label: `${name} está grabando un audio…`, audio: true }
      : { label: `${name} está escribiendo…`, audio: false };
  }

  if (n === 2) {
    const [a, b] = typers;
    if (allAudio) {
      return { label: `${a.name} y ${b.name} están grabando un audio…`, audio: true };
    }
    // Mezcla text/audio → prioriza un conteo sensato en lugar de forzar un verbo.
    if (a.kind !== b.kind) {
      return { label: '2 personas están escribiendo…', audio: false };
    }
    return { label: `${a.name} y ${b.name} están escribiendo…`, audio: false };
  }

  return { label: 'Varias personas están escribiendo…', audio: false };
}

export function WallTypingIndicator() {
  const typers = useWallTypers();
  const info = describeTypers(typers);
  if (!info) return null;

  return (
    <div
      aria-live="polite"
      className="flex items-center gap-2 px-4 pb-1 pt-0.5 text-xs text-on-surface-variant md:px-6"
    >
      {info.audio ? (
        <Mic className="size-3.5 shrink-0 text-primary motion-safe:animate-pulse" aria-hidden />
      ) : (
        <TypingDots />
      )}
      <span className="truncate">{info.label}</span>
    </div>
  );
}

/** Tres puntitos con pulso escalonado; sin animación bajo `prefers-reduced-motion` (`motion-safe`). */
function TypingDots() {
  return (
    <span className="flex shrink-0 items-center gap-0.5" aria-hidden>
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="size-1.5 rounded-full bg-on-surface-variant motion-safe:animate-pulse"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}
