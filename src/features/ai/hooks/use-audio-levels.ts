import { useEffect, useState } from 'react';

/**
 * Niveles de audio en vivo del micrófono (QL-78) para pintar la onda "estilo WhatsApp" mientras se
 * dicta por voz. La Web Speech API NO expone el stream de audio, así que abrimos un `getUserMedia`
 * SEPARADO solo para visualizar y lo cerramos por completo al parar. Es 100% cliente: nada de audio
 * sale de la máquina ni pasa por el backend (por eso vive como estado local, no en TanStack Query).
 *
 * Móvil (QL-191 bugfix):
 * - En Android/iOS el `AudioContext` nace **suspendido** y el analizador devuelve ceros (onda plana)
 *   hasta que se llama a `resume()` tras un gesto del usuario. Se crea y se reanuda al principio del
 *   efecto, que corre en la cadena del click que activó el dictado (no se difiere a un timeout).
 * - El segundo consumidor del micrófono puede pelearse con el reconocimiento de voz. Con
 *   `capture: false` el hook NO abre el micrófono y devuelve una onda **sintética**: se prioriza la
 *   transcripción y el usuario sigue viendo actividad.
 *
 * Devuelve `barCount` alturas normalizadas (0..1) y `capturing` (si los datos son reales). Degrada a
 * la onda sintética si `getUserMedia` falla (permiso denegado / micrófono ocupado) o el navegador no
 * trae `AudioContext`: el dictado sigue funcionando.
 */
interface UseAudioLevelsOptions {
  /** Mientras sea `true`, la onda está viva (con datos reales o sintéticos). */
  active: boolean;
  /** `false` para NO abrir el micrófono (degradación por conflicto): solo onda sintética. */
  capture?: boolean;
  /** Número de barras a devolver. */
  barCount?: number;
}

interface UseAudioLevels {
  /** Alturas normalizadas (0..1), una por barra. */
  levels: number[];
  /** `true` solo cuando el analizador está entregando datos REALES del micrófono. */
  capturing: boolean;
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
/** Reintentos de `resume()` antes de rendirse (el 1.º va en la cadena del gesto del usuario). */
const MAX_RESUME_ATTEMPTS = 3;
/** Cadencia de la onda sintética: suficiente para verse fluida sin castigar la batería. */
const SYNTHETIC_TICK_MS = 90;

export function useAudioLevels({
  active,
  capture = true,
  barCount = DEFAULT_BAR_COUNT,
}: UseAudioLevelsOptions): UseAudioLevels {
  const [levels, setLevels] = useState<number[]>(() => new Array<number>(barCount).fill(0));
  const [capturing, setCapturing] = useState(false);

  // Captura real: micrófono + AnalyserNode.
  useEffect(() => {
    if (!active || !capture) return;

    const AudioContextClass = getAudioContextClass();
    const canCapture =
      AudioContextClass !== null &&
      typeof navigator !== 'undefined' &&
      typeof navigator.mediaDevices?.getUserMedia === 'function';
    if (!AudioContextClass || !canCapture) return; // degrada a onda sintética

    let stream: MediaStream | null = null;
    let analyser: AnalyserNode | null = null;
    let rafId = 0;
    let cancelled = false;
    let resumeAttempts = 0;

    // El contexto se crea AQUÍ (no dentro del `.then` de `getUserMedia`) para no perder la cadena
    // del gesto: tras el prompt de permisos el navegador ya no lo considera "activación".
    const audioContext = new AudioContextClass();

    const ensureRunning = () => {
      if (cancelled) return;
      if (audioContext.state !== 'suspended') return;
      if (resumeAttempts >= MAX_RESUME_ATTEMPTS) return;
      resumeAttempts += 1;
      void audioContext.resume().catch(() => {
        // Sin `resume()` el analizador da ceros: se cae a la onda sintética, sin romper el dictado.
      });
    };
    ensureRunning();

    const stopRaf = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
    };

    // Si el reconocimiento de voz se queda con el micrófono, el track muere: se refleja al instante
    // para que la onda pase a modo sintético en vez de quedarse plana.
    const handleTrackEnded = () => {
      stopRaf();
      setCapturing(false);
    };

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((mediaStream) => {
        if (cancelled) {
          for (const track of mediaStream.getTracks()) track.stop();
          return;
        }
        stream = mediaStream;
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 64; // 32 bins de frecuencia
        analyser.smoothingTimeConstant = 0.75; // suaviza para una onda fluida
        audioContext.createMediaStreamSource(mediaStream).connect(analyser);
        for (const track of mediaStream.getTracks()) {
          track.addEventListener('ended', handleTrackEnded);
        }

        const bins = new Uint8Array(analyser.frequencyBinCount);
        const step = Math.max(1, Math.floor(bins.length / barCount));

        const tick = () => {
          if (cancelled || !analyser) return;
          ensureRunning(); // en móvil el contexto puede seguir suspendido tras el primer intento
          analyser.getByteFrequencyData(bins);
          const next = new Array<number>(barCount);
          for (let i = 0; i < barCount; i += 1) next[i] = (bins[i * step] ?? 0) / 255;
          setLevels(next);
          rafId = requestAnimationFrame(tick);
        };
        setCapturing(true);
        rafId = requestAnimationFrame(tick);
      })
      .catch(() => {
        // Permiso denegado o micrófono ocupado por el reconocimiento: degrada a onda sintética.
      });

    return () => {
      cancelled = true;
      stopRaf();
      if (stream) {
        for (const track of stream.getTracks()) {
          track.removeEventListener('ended', handleTrackEnded);
          track.stop();
        }
        stream = null;
      }
      if (audioContext.state !== 'closed') void audioContext.close();
      analyser = null;
      setCapturing(false);
    };
  }, [active, capture, barCount]);

  // Onda sintética: mientras se graba SIN datos reales (permiso denegado, contexto suspendido o
  // degradación por conflicto de micrófono) se anima igual, para que se vea que está escuchando.
  useEffect(() => {
    if (!active || capturing) return;

    let frame = 0;
    const intervalId = window.setInterval(() => {
      frame += 1;
      setLevels(
        Array.from(
          { length: barCount },
          (_, i) => 0.2 + 0.3 * (1 + Math.sin(i * 0.55 + frame * 0.4)),
        ),
      );
    }, SYNTHETIC_TICK_MS);

    return () => window.clearInterval(intervalId);
  }, [active, capturing, barCount]);

  // Al apagarse, la onda vuelve a reposo (una sola vez, no en cada frame).
  useEffect(() => {
    if (active) return;
    setCapturing(false);
    setLevels(new Array<number>(barCount).fill(0));
  }, [active, barCount]);

  return { levels, capturing };
}
