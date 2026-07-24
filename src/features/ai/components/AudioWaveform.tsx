import { cn } from '@/lib/utils';
import { useAudioLevels } from '../hooks/use-audio-levels';

interface AudioWaveformProps {
  /** Mientras sea `true`, la onda está viva (con datos del micrófono o sintética). */
  active: boolean;
  /**
   * `false` para NO abrir un segundo consumidor del micrófono (conflicto con el reconocimiento en
   * móvil): la onda pasa a un pulso sintético y la transcripción se queda con el micro.
   */
  capture?: boolean;
  className?: string;
}

/**
 * Onda de audio en vivo "estilo WhatsApp" (QL-78): una barra vertical por nivel, con altura
 * proporcional al volumen captado. Se pinta con tokens M3 (`bg-error`, coherente con el botón de
 * micrófono en rojo mientras graba). El componente consume `useAudioLevels`, así que el re-render
 * a ~60fps queda confinado a este subárbol (no re-renderiza todo el composer).
 *
 * Nunca se queda plana: si no hay datos reales (permiso denegado, `AudioContext` suspendido o
 * degradación por conflicto) el hook devuelve una onda sintética para que se siga viendo actividad.
 */
export function AudioWaveform({ active, capture = true, className }: AudioWaveformProps) {
  const { levels } = useAudioLevels({ active, capture });

  return (
    <div
      className={cn('flex h-6 items-center justify-center gap-0.5 overflow-hidden', className)}
      aria-hidden="true"
    >
      {levels.map((level, i) => (
        <span
          key={i}
          className="w-1 rounded-full bg-error transition-[height] duration-75 ease-out"
          // Mínimo visible para que la onda "respire" incluso en silencio.
          style={{ height: `${Math.max(0.12, level) * 100}%` }}
        />
      ))}
    </div>
  );
}
