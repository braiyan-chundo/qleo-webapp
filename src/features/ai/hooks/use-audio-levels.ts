import { useEffect, useState } from 'react';

/**
 * Niveles de audio en vivo del micrófono (QL-78) para pintar la onda "estilo WhatsApp" mientras se
 * dicta por voz. La Web Speech API NO expone el stream de audio, así que abrimos un `getUserMedia`
 * SEPARADO solo para visualizar y lo cerramos por completo al parar. Es 100% cliente: nada de audio
 * sale de la máquina ni pasa por el backend (por eso vive como estado local, no en TanStack Query).
 *
 * Devuelve `barCount` alturas normalizadas (0..1). Degrada a un array de ceros si `getUserMedia`
 * falla (permiso denegado / sin micrófono) o el navegador no trae `AudioContext`: el dictado sigue
 * funcionando sin onda.
 */
interface UseAudioLevelsOptions {
  /** Mientras sea `true`, abre el micrófono y actualiza los niveles en cada frame. */
  active: boolean;
  /** Número de barras a devolver. */
  barCount?: number;
}

/** Constructor de `AudioContext` tolerando el prefijo `webkit` de Safari, sin `any`. */
function getAudioContextClass(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

const DEFAULT_BAR_COUNT = 28;

export function useAudioLevels({
  active,
  barCount = DEFAULT_BAR_COUNT,
}: UseAudioLevelsOptions): number[] {
  const [levels, setLevels] = useState<number[]>(() => new Array<number>(barCount).fill(0));

  useEffect(() => {
    if (!active) return;

    const AudioContextClass = getAudioContextClass();
    const canCapture =
      AudioContextClass !== null &&
      typeof navigator !== 'undefined' &&
      typeof navigator.mediaDevices?.getUserMedia === 'function';
    if (!AudioContextClass || !canCapture) return; // degrada: sin onda, el dictado sigue

    let stream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let rafId = 0;
    let cancelled = false;

    const stopAll = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      if (stream) {
        for (const track of stream.getTracks()) track.stop();
        stream = null;
      }
      if (audioContext && audioContext.state !== 'closed') void audioContext.close();
      audioContext = null;
      analyser = null;
    };

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((mediaStream) => {
        if (cancelled) {
          for (const track of mediaStream.getTracks()) track.stop();
          return;
        }
        stream = mediaStream;
        audioContext = new AudioContextClass();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 64; // 32 bins de frecuencia
        analyser.smoothingTimeConstant = 0.75; // suaviza para una onda fluida
        audioContext.createMediaStreamSource(mediaStream).connect(analyser);

        const bins = new Uint8Array(analyser.frequencyBinCount);
        const step = Math.max(1, Math.floor(bins.length / barCount));

        const tick = () => {
          if (cancelled || !analyser) return;
          analyser.getByteFrequencyData(bins);
          const next = new Array<number>(barCount);
          for (let i = 0; i < barCount; i += 1) next[i] = (bins[i * step] ?? 0) / 255;
          setLevels(next);
          rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
      })
      .catch(() => {
        // Permiso denegado o sin micrófono: degrada silenciosamente (sin onda).
      });

    return () => {
      cancelled = true;
      stopAll();
      setLevels(new Array<number>(barCount).fill(0));
    };
  }, [active, barCount]);

  return levels;
}
