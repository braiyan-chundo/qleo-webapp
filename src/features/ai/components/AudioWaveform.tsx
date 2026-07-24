import { cn } from '@/lib/utils';
import { useAudioLevels } from '../hooks/use-audio-levels';

interface AudioWaveformProps {
  /** Mientras sea `true`, captura el micrófono y anima las barras al ritmo de la voz. */
  active: boolean;
  className?: string;
}

/**
 * Onda de audio en vivo "estilo WhatsApp" (QL-78): una barra vertical por nivel, con altura
 * proporcional al volumen captado. Se pinta con tokens M3 (`bg-error`, coherente con el botón de
 * micrófono en rojo mientras graba). El componente consume `useAudioLevels`, así que el re-render
 * a ~60fps queda confinado a esta subárbol (no re-renderiza todo el composer).
 */
export function AudioWaveform({ active, className }: AudioWaveformProps) {
  const levels = useAudioLevels({ active });

  return (
    <div
      className={cn(
        'flex h-10 flex-1 items-center justify-center gap-0.5 overflow-hidden px-2',
        className,
      )}
      aria-hidden="true"
    >
      {levels.map((level, i) => (
        <span
          key={i}
          className="w-1 rounded-full bg-error transition-[height] duration-75 ease-out"
          // Mínimo visible para que la onda "respire" incluso en silencio.
          style={{ height: `${Math.max(0.08, level) * 100}%` }}
        />
      ))}
    </div>
  );
}
