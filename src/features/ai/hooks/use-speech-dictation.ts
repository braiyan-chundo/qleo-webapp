import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Dictado por voz (QL-191) sobre la Web Speech API del navegador. Es un método de ENTRADA
 * puramente cliente: el navegador transcribe voz→texto y el resultado se anexa al composer para
 * que el usuario lo revise y envíe con el flujo normal. No sale audio de la máquina ni pasa por
 * el backend; por eso vive como estado local y no en TanStack Query.
 *
 * Móvil (QL-191 bugfix): en Chrome de Android el reconocimiento con `continuous: true` **termina
 * solo** tras una pausa corta aunque el usuario siga hablando. Aquí se reinicia automáticamente en
 * `onend` manteniendo `recording === true` (sin parpadeos), con guarda anti-bucle. Si el micrófono
 * entra en conflicto (`audio-capture` o cortes encadenados) se marca `canVisualize = false` para que
 * el visualizador suelte SU stream: la transcripción manda sobre la onda.
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

/** Error del dictado listo para pintar; `blocking` = exige una acción del usuario (permisos). */
export interface DictationError {
  message: string;
  blocking: boolean;
}

/** Devuelve el constructor del reconocedor (estándar o con prefijo `webkit`), o `null`. */
function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as SpeechRecognitionWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Mensaje de permisos: visible y accionable, cubre navegador y PWA instalada (Android). */
const PERMISSION_ERROR: DictationError = {
  message:
    'Permite el acceso al micrófono para dictar. Si lo bloqueaste, actívalo en los ajustes del navegador o de la app.',
  blocking: true,
};

/** Mapea los códigos de error de la Web Speech API a un mensaje corto y amable. */
function mapDictationError(code: string): DictationError {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return PERMISSION_ERROR;
    case 'network':
      return { message: 'Sin conexión para el dictado.', blocking: false };
    case 'audio-capture':
      return { message: 'No se pudo leer el micrófono. Reintentando…', blocking: false };
    default:
      return { message: 'No se pudo iniciar el dictado.', blocking: false };
  }
}

/** Una sesión más corta que esto cuenta como "corte" para la guarda anti-bucle. */
const RAPID_SESSION_MS = 1000;
/** Cortes encadenados tolerados antes de rendirse de verdad. */
const MAX_RAPID_RESTARTS = 4;
/**
 * Reinicios seguidos SIN transcripción tolerados. Acota el bucle cuando el fallo es persistente
 * (p. ej. `audio-capture` cada dos segundos) o el usuario dejó el micro abierto en silencio; se
 * reinicia a cero en cuanto entra texto, así que un dictado real nunca lo alcanza.
 */
const MAX_BARREN_RESTARTS = 8;
/** A partir de este nº de cortes se sospecha conflicto de micrófono y se suelta la onda. */
const CONFLICT_RESTART_THRESHOLD = 2;
/** Respiro antes de reanudar: `start()` inmediato dentro de `onend` es inestable en Android. */
const RESTART_DELAY_MS = 120;

interface UseSpeechDictationOptions {
  /** BCP-47 del reconocimiento (p. ej. `'es-CO'`). */
  lang: string;
  /** Recibe cada fragmento FINAL transcrito; el composer lo anexa. */
  onTranscript: (text: string) => void;
}

interface UseSpeechDictation {
  /** `false` si el navegador no expone la Web Speech API (Firefox/Safari de escritorio). */
  supported: boolean;
  /** Se mantiene `true` a través de los reinicios automáticos: solo el usuario (o un fallo real) lo baja. */
  recording: boolean;
  /** Texto provisional del motor (aún no final), para que se VEA que está transcribiendo. */
  interim: string;
  error: DictationError | null;
  /** `false` cuando hay conflicto de micrófono: el visualizador debe soltar su stream. */
  canVisualize: boolean;
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
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<DictationError | null>(null);
  const [canVisualize, setCanVisualize] = useState(true);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  // `true` cuando la parada la pidió el usuario (o un fallo definitivo): bloquea el auto-reinicio.
  const userStoppedRef = useRef(false);
  const restartTimerRef = useRef(0);
  const sessionStartedAtRef = useRef(0);
  const rapidRestartsRef = useRef(0);
  const barrenRestartsRef = useRef(0);
  // Texto provisional vivo: si el motor muere sin finalizarlo, se vuelca igual al composer.
  const interimRef = useRef('');
  const lastFinalRef = useRef('');
  // Refs para que los listeners usen siempre el último valor sin recrear la instancia.
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const langRef = useRef(lang);
  langRef.current = lang;

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current !== 0) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = 0;
    }
  }, []);

  /** Parada pedida por el usuario: corta el auto-reinicio y cierra la sesión activa. */
  const stop = useCallback(() => {
    userStoppedRef.current = true;
    const hadPendingRestart = restartTimerRef.current !== 0;
    clearRestartTimer();
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (hadPendingRestart) {
      // Se pulsó justo entre dos reinicios: no hay sesión viva que emita `onend`, se cierra a mano.
      recognition.abort();
      recognitionRef.current = null;
      setRecording(false);
      setInterim('');
      return;
    }
    recognition.stop(); // el resto lo resuelve `onend`
  }, [clearRestartTimer]);

  const toggle = useCallback(() => {
    // Ya hay un reconocimiento vivo: detenerlo.
    if (recognitionRef.current) {
      stop();
      return;
    }

    const Recognition = getSpeechRecognition();
    if (!Recognition) return;

    userStoppedRef.current = false;
    rapidRestartsRef.current = 0;
    barrenRestartsRef.current = 0;
    interimRef.current = '';
    lastFinalRef.current = '';
    setInterim('');

    const recognition = new Recognition();
    recognition.lang = langRef.current;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    /** Cierra la sesión de verdad: refleja `recording=false` y deja el motivo a la vista. */
    const finish = (reason: DictationError | null) => {
      clearRestartTimer();
      recognitionRef.current = null;
      userStoppedRef.current = true;
      if (reason) setError(reason);
      setRecording(false);
      setInterim('');
    };

    /** Arranca (o reanuda) la sesión marcando el instante para la guarda anti-bucle. */
    const beginSession = () => {
      sessionStartedAtRef.current = Date.now();
      try {
        recognition.start();
      } catch (err) {
        // `InvalidStateError` = ya estaba corriendo: la sesión sigue viva, no hay nada que hacer.
        if (err instanceof DOMException && err.name === 'InvalidStateError') return;
        finish({ message: 'No se pudo iniciar el dictado.', blocking: false });
      }
    };

    /** Vuelca al composer lo provisional que el motor no llegó a finalizar (Android corta seco). */
    const flushInterim = () => {
      const pending = interimRef.current.trim();
      interimRef.current = '';
      setInterim('');
      if (!pending) return;
      // Evita duplicar si el motor ya emitió exactamente ese texto como final.
      if (lastFinalRef.current.endsWith(pending)) return;
      onTranscriptRef.current(pending);
    };

    recognition.onstart = () => {
      sessionStartedAtRef.current = Date.now();
      setError(null);
      setRecording(true);
    };

    recognition.onresult = (event) => {
      // Se recorre SOLO desde `resultIndex` (los resultados anteriores ya son inmutables) y se
      // anexa únicamente lo FINAL: así los interinos no duplican texto ni un final se emite dos veces.
      let finalChunk = '';
      let interimChunk = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) finalChunk += result[0].transcript;
        else interimChunk += result[0].transcript;
      }

      interimRef.current = interimChunk;
      setInterim(interimChunk.trim());

      const trimmed = finalChunk.trim();
      if (!trimmed) return;
      lastFinalRef.current = trimmed;
      // Hubo transcripción real: esto no es un bucle de cortes, se perdonan los reinicios previos.
      rapidRestartsRef.current = 0;
      barrenRestartsRef.current = 0;
      onTranscriptRef.current(trimmed);
    };

    recognition.onerror = (event) => {
      switch (event.error) {
        case 'no-speech':
        case 'aborted':
          // Cierres normales (silencio o detención manual): `onend` decide si reanuda.
          return;
        case 'audio-capture':
          // Otro consumidor tiene el micrófono: se suelta la onda y se sigue transcribiendo.
          setCanVisualize(false);
          setError(mapDictationError(event.error));
          return;
        case 'not-allowed':
        case 'service-not-allowed':
          // Permisos: no tiene sentido reintentar. Se cierra aquí mismo (sin esperar a `onend`, que
          // en la PWA de Android no siempre llega tras este error) con un aviso prominente.
          finish(PERMISSION_ERROR);
          return;
        default:
          setError(mapDictationError(event.error));
      }
    };

    recognition.onend = () => {
      flushInterim();

      if (userStoppedRef.current) {
        clearRestartTimer();
        recognitionRef.current = null;
        setRecording(false);
        return;
      }

      // Android corta la sesión tras una pausa corta: se reanuda para que el usuario no lo note.
      const elapsed = Date.now() - sessionStartedAtRef.current;
      rapidRestartsRef.current = elapsed < RAPID_SESSION_MS ? rapidRestartsRef.current + 1 : 0;

      if (rapidRestartsRef.current >= CONFLICT_RESTART_THRESHOLD) {
        // Cortes encadenados = casi siempre pelea por el micrófono: la onda es lo prescindible.
        setCanVisualize(false);
      }

      if (rapidRestartsRef.current >= MAX_RAPID_RESTARTS) {
        finish({
          message: 'El dictado se interrumpió. Vuelve a pulsar el micrófono para continuar.',
          blocking: false,
        });
        return;
      }

      barrenRestartsRef.current += 1; // `onresult` lo pone a cero en cuanto llega texto
      if (barrenRestartsRef.current >= MAX_BARREN_RESTARTS) {
        finish({
          message: 'El dictado se detuvo porque no se escuchó nada. Pulsa el micrófono para retomarlo.',
          blocking: false,
        });
        return;
      }

      clearRestartTimer();
      restartTimerRef.current = window.setTimeout(() => {
        restartTimerRef.current = 0;
        if (userStoppedRef.current || recognitionRef.current !== recognition) return;
        beginSession();
      }, RESTART_DELAY_MS);
    };

    recognitionRef.current = recognition;
    beginSession();
  }, [clearRestartTimer, stop]);

  // Al desmontar: cancela reinicios pendientes, aborta el reconocimiento vivo y suelta los listeners.
  useEffect(() => {
    return () => {
      if (restartTimerRef.current !== 0) window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = 0;
      userStoppedRef.current = true;
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

  return { supported, recording, interim, error, canVisualize, toggle, stop };
}
