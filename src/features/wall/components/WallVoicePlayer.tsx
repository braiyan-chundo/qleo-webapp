import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, Pause, Play } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { Attachment } from '@/features/attachments/services/attachments.service';

import { useWallAudio } from '../hooks/use-wall-audio';
import { formatVoiceDuration } from '../lib/wall-audio';

interface WallVoicePlayerProps {
  attachment: Attachment;
}

/**
 * Reproductor de **nota de voz** del muro (QL-104, estilo WhatsApp): botón play/pausa + barra de
 * progreso + tiempo. El binario es privado (`downloadUrl` requiere Bearer), así que se baja con
 * `useWallAudio` (fetch+blob) **de forma perezosa**: solo al primer play. La duración se toma de
 * `durationSec` (o del `<audio>` una vez cargado). Reusa el flujo blob+token de imágenes/adjuntos.
 */
export function WallVoicePlayer({ attachment }: WallVoicePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  // Se activa la descarga al primer play (perezoso, como las imágenes en línea).
  const [requested, setRequested] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);

  const { data: blobUrl, isLoading, isError } = useWallAudio(attachment.downloadUrl, requested);

  const total = attachment.durationSec ?? 0;
  const progress = total > 0 ? Math.min(100, (current / total) * 100) : 0;

  // Cuando el blob está listo tras pedir play, arranca la reproducción.
  useEffect(() => {
    if (!requested || !blobUrl) return;
    const el = audioRef.current;
    if (el && el.paused) void el.play().catch(() => setPlaying(false));
  }, [requested, blobUrl]);

  const toggle = () => {
    const el = audioRef.current;
    if (!blobUrl) {
      // Aún no está el blob: pídelo; el efecto lo reproducirá al llegar.
      setRequested(true);
      return;
    }
    if (!el) return;
    if (el.paused) void el.play().catch(() => setPlaying(false));
    else el.pause();
  };

  const isBusy = requested && isLoading && !blobUrl;

  return (
    <div className="mt-1 flex min-w-0 max-w-xs items-center gap-2.5 rounded-full bg-surface-container-low px-2 py-1.5">
      <button
        type="button"
        onClick={toggle}
        disabled={isError}
        aria-label={playing ? 'Pausar nota de voz' : 'Reproducir nota de voz'}
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50',
        )}
      >
        {isError ? (
          <AlertCircle className="size-4" />
        ) : isBusy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : playing ? (
          <Pause className="size-4" />
        ) : (
          <Play className="size-4" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest">
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <span className="shrink-0 text-xs tabular-nums text-on-surface-variant">
        {formatVoiceDuration(playing || current > 0 ? current : total)}
      </span>

      {blobUrl && (
        <audio
          ref={audioRef}
          src={blobUrl}
          preload="none"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setCurrent(0);
          }}
          onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
          className="hidden"
        />
      )}
    </div>
  );
}
