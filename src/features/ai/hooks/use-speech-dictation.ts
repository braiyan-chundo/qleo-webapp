import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Dictado por voz (QL-191) sobre la Web Speech API del navegador. Es un método de ENTRADA
 * puramente cliente: el navegador transcribe voz→texto y el resultado se anexa al composer para
 * que el usuario lo revise y envíe con el flujo normal. No sale audio de la máquina ni pasa por
 * el backend; por eso vive como estado local y no en TanStack Query.
 *
 * Los tipos de la Web Speech API no están en el `lib.dom` estándar, así que se declaran aquí con
 * interfaces propias (sin `any`) y se accede a la clase con un cast tipado del `window`.
 */

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  readonly [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

interface SpeechRecognitionWindow {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

/** Devuelve el constructor del reconocedor (estándar o con prefijo `webkit`), o `null`. */
function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as SpeechRecognitionWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Mapea los códigos de error de la Web Speech API a un mensaje corto y amable. */
function mapDictationError(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Permite el micrófono para dictar.';
    case 'network':
      return 'Sin conexión para el dictado.';
    default:
      return 'No se pudo iniciar el dictado.';
  }
}

interface UseSpeechDictationOptions {
  /** BCP-47 del reconocimiento (p. ej. `'es-CO'`). */
  lang: string;
  /** Recibe cada fragmento FINAL transcrito; el composer lo anexa. */
  onTranscript: (text: string) => void;
}

interface UseSpeechDictation {
  /** `false` si el navegador no expone la Web Speech API (Firefox/Safari de escritorio). */
  supported: boolean;
  recording: boolean;
  error: string | null;
  /** Alterna: arranca un reconocimiento nuevo o detiene el activo. */
  toggle: () => void;
  stop: () => void;
}

export function useSpeechDictation({
  lang,
  onTranscript,
}: UseSpeechDictationOptions): UseSpeechDictation {
  const [supported] = useState(() => getSpeechRecognition() !== null);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  // Refs para que los listeners usen siempre el último valor sin recrear la instancia.
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const langRef = useRef(lang);
  langRef.current = lang;

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const toggle = useCallback(() => {
    // Ya hay un reconocimiento vivo: detenerlo (el resto lo resuelve `onend`).
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    const Recognition = getSpeechRecognition();
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.lang = langRef.current;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setError(null);
      setRecording(true);
    };

    recognition.onresult = (event) => {
      // Se recorre SOLO desde `resultIndex` (los resultados anteriores ya son inmutables) y se
      // anexa únicamente lo FINAL: así los interinos no duplican texto ni un final se emite dos veces.
      let finalChunk = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) finalChunk += result[0].transcript;
      }
      const trimmed = finalChunk.trim();
      if (trimmed) onTranscriptRef.current(trimmed);
    };

    recognition.onerror = (event) => {
      // `no-speech`/`aborted` son cierres normales (silencio o detención manual), no errores reales.
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      setError(mapDictationError(event.error));
    };

    recognition.onend = () => {
      // Web Speech puede terminar solo tras un silencio; refleja el estado real.
      recognitionRef.current = null;
      setRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  // Al desmontar: aborta cualquier reconocimiento vivo y suelta los listeners.
  useEffect(() => {
    return () => {
      const recognition = recognitionRef.current;
      if (!recognition) return;
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
      recognitionRef.current = null;
    };
  }, []);

  return { supported, recording, error, toggle, stop };
}
