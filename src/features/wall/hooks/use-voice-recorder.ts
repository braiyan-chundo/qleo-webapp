import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Grabación de **notas de voz** del muro (QL-104, §3.25.2) con `MediaRecorder`. Encapsula el
 * ciclo permiso → grabar → detener/cancelar y expone el estado para la UI del composer:
 * - `isSupported`: el navegador tiene `MediaRecorder` + `getUserMedia`.
 * - `status`: `'idle'` | `'recording'`.
 * - `seconds`: tiempo transcurrido (para el contador).
 * - `start()`: pide permiso y arranca; **lanza** si se deniega o no hay soporte (el composer
 *   lo captura y muestra un toast claro, sin romper).
 * - `stop()`: detiene y resuelve el `{ blob, durationSec, mimeType }` (o `null` si nada útil).
 * - `cancel()`: detiene y descarta.
 *
 * Prefiere `audio/webm;codecs=opus`; si el navegador no lo soporta, degrada a otros contenedores
 * de la lista blanca del backend (`audio/webm`, `audio/mp4`, `audio/ogg`).
 */

/** Candidatos de `mimeType`, en orden de preferencia; deben estar en la whitelist del backend. */
const PREFERRED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg',
];

export interface VoiceRecording {
  blob: Blob;
  /** Duración en segundos (entero, mínimo 1). */
  durationSec: number;
  /** MIME base sin parámetros (`audio/webm`, `audio/mp4`…), para nombrar/subir el archivo. */
  mimeType: string;
}

type RecorderStatus = 'idle' | 'recording';

function hasRecorderSupport(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

/** Primer `mimeType` soportado por este navegador, o `undefined` (deja elegir al navegador). */
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return undefined;
  return PREFERRED_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

export function useVoiceRecorder() {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [seconds, setSeconds] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /** Libera el stream del micrófono (detiene los tracks) y limpia el recorder. */
  const teardown = useCallback(() => {
    clearTimer();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, [clearTimer]);

  // Al desmontar, corta el micro si quedó abierto (defensivo).
  useEffect(() => teardown, [teardown]);

  const start = useCallback(async () => {
    if (!hasRecorderSupport()) {
      throw new Error('UNSUPPORTED');
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorderRef.current = recorder;
    recorder.start();
    startedAtRef.current = Date.now();
    setSeconds(0);
    setStatus('recording');
    timerRef.current = window.setInterval(() => {
      setSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 250);
  }, []);

  const stop = useCallback((): Promise<VoiceRecording | null> => {
    const recorder = recorderRef.current;
    clearTimer();
    setStatus('idle');
    if (!recorder || recorder.state === 'inactive') {
      teardown();
      return Promise.resolve(null);
    }
    const durationSec = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
    return new Promise<VoiceRecording | null>((resolve) => {
      recorder.onstop = () => {
        const type = (recorder.mimeType || 'audio/webm').split(';')[0];
        const blob = new Blob(chunksRef.current, { type });
        teardown();
        setSeconds(0);
        resolve(blob.size > 0 ? { blob, durationSec, mimeType: type } : null);
      };
      recorder.stop();
    });
  }, [clearTimer, teardown]);

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    clearTimer();
    setStatus('idle');
    setSeconds(0);
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => teardown();
      recorder.stop();
    } else {
      teardown();
    }
  }, [clearTimer, teardown]);

  return {
    isSupported: hasRecorderSupport(),
    status,
    seconds,
    start,
    stop,
    cancel,
  };
}
