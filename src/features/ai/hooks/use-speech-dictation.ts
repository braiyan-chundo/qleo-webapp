import { useCallback, useEffect, useRef, useState } from 'react';

import { isCoarsePointerDevice } from '@/shared/lib/device';

/**
 * Dictado por voz (QL-191) sobre la Web Speech API del navegador. Es un método de ENTRADA
 * puramente cliente: el navegador transcribe voz→texto y el resultado se anexa al composer para
 * que el usuario lo revise y envíe con el flujo normal. No sale audio de la máquina ni pasa por
 * el backend; por eso vive como estado local y no en TanStack Query.
 *
 * Móvil (QL-191 bugfix 2) — el motor de Chrome en Android NO finaliza los resultados cuando
 * `continuous = true`: la sesión se queda abierta pero no llega ningún `isFinal`, así que no
 * aterriza nada de texto. El patrón canónico (el de las librerías de referencia) es:
 *
 *   `continuous = false` + `interimResults = true` + auto-reinicio en `onend`.
 *
 * Así CADA frase cierra su sesión con su resultado final y el bucle de reinicio da la sensación de
 * dictado continuo. Se aplica en todas las plataformas (en escritorio funciona igual de bien) para
 * no mantener dos comportamientos distintos.
 *
 * Consecuencia importante: con `continuous = false` los `onend` son CONSTANTES Y NORMALES, y las
 * sesiones de menos de un segundo son habituales en los silencios. Por eso las guardas anti-bucle
 * NO cuentan reinicios: solo cuentan finales anómalos (`onerror` real) y aplican un tope por TIEMPO
 * sin oír nada. Ver `MAX_ANOMALOUS_ENDS` y `SILENT_TIMEOUT_MS`.
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

/**
 * Finales ANÓMALOS seguidos tolerados antes de rendirse. Anómalo = `onerror` que no sea `no-speech`
 * ni `aborted` (p. ej. `audio-capture`, `network`). Un `onend` limpio NO cuenta: con
 * `continuous = false` es el final normal de cada frase. El contador se pone a cero en cuanto llega
 * cualquier texto, así que un dictado real jamás lo alcanza.
 */
const MAX_ANOMALOUS_ENDS = 10;
/** `start()` lanzando de forma consecutiva: a la tercera se asume que el motor no va a arrancar. */
const MAX_START_FAILURES = 3;
/**
 * Tope de seguridad por TIEMPO (no por número de reinicios): si pasa este rato sin que llegue NADA
 * —ni final ni provisional— se corta el bucle con el aviso de "no se escuchó nada". Cualquier texto
 * reinicia la cuenta, de modo que un dictado real solo lo alcanza si el micro se quedó abierto y
 * olvidado un minuto entero.
 */
const SILENT_TIMEOUT_MS = 60_000;
/** Respiro entre frases: `start()` inmediato dentro de `onend` es inestable en Android. */
const RESTART_DELAY_MS = 120;
/** Respiro mayor cuando el reinicio viene de un fallo, para no encadenar reintentos en caliente. */
const ANOMALOUS_RESTART_DELAY_MS = 600;

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
  /**
   * `false` cuando el visualizador NO debe abrir su propio micrófono: siempre en dispositivos
   * táctiles (en Android el segundo consumidor degrada el reconocimiento) y en escritorio cuando el
   * motor reporta `audio-capture`. La onda pasa a modo sintético: la transcripción manda.
   */
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
  // En táctil arranca ya en `false`: el micro es solo para el reconocimiento. Una vez degradado no
  // se vuelve a subir en toda la vida de la página (reintentar es arriesgar la transcripción).
  const [canVisualize, setCanVisualize] = useState(() => !isCoarsePointerDevice());

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  // `true` cuando la parada la pidió el usuario (o un fallo definitivo): bloquea el auto-reinicio.
  const userStoppedRef = useRef(false);
  const restartTimerRef = useRef(0);
  // Finales anómalos consecutivos y fallos consecutivos de `start()`: las dos únicas señales de
  // fallo real. Cualquier texto transcrito las pone a cero.
  const anomalousEndsRef = useRef(0);
  const startFailuresRef = useRef(0);
  // Instante del último texto recibido (final O provisional): base del tope por tiempo.
  const lastTranscriptAtRef = useRef(0);
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
      // Se pulsó justo entre dos frases: no hay sesión viva que emita `onend`, se cierra a mano.
      // Con `continuous = false` esta ventana se da a menudo, así que el caso importa.
      recognition.abort();
      recognitionRef.current = null;
      setRecording(false);
      setInterim('');
      return;
    }
    recognition.stop(); // el resto lo resuelve `onend` (y `stop` deja finalizar la última frase)
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
    anomalousEndsRef.current = 0;
    startFailuresRef.current = 0;
    lastTranscriptAtRef.current = Date.now();
    interimRef.current = '';
    lastFinalRef.current = '';
    setInterim('');

    const recognition = new Recognition();
    recognition.lang = langRef.current;
    // Ver la cabecera: `false` es lo que hace que Android emita resultados finales. El dictado
    // continuo lo da el bucle de reinicio de `onend`, no esta bandera.
    recognition.continuous = false;
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

    /** Programa la siguiente frase. La guarda evita reanudar una sesión ya descartada. */
    const scheduleRestart = (delayMs: number) => {
      clearRestartTimer();
      restartTimerRef.current = window.setTimeout(() => {
        restartTimerRef.current = 0;
        if (userStoppedRef.current || recognitionRef.current !== recognition) return;
        beginSession();
      }, delayMs);
    };

    /** Arranca (o reanuda) la sesión. Un `start()` que lanza se reintenta, no mata el dictado. */
    const beginSession = () => {
      try {
        recognition.start();
        startFailuresRef.current = 0;
      } catch (err) {
        // `InvalidStateError` = ya estaba corriendo: la sesión sigue viva, no hay nada que hacer.
        if (err instanceof DOMException && err.name === 'InvalidStateError') return;
        startFailuresRef.current += 1;
        if (startFailuresRef.current >= MAX_START_FAILURES) {
          finish({ message: 'No se pudo iniciar el dictado.', blocking: false });
          return;
        }
        scheduleRestart(ANOMALOUS_RESTART_DELAY_MS);
      }
    };

    /** Vuelca al composer lo provisional que el motor no llegó a finalizar (Android corta seco). */
    const flushInterim = () => {
      const pending = interimRef.current.trim();
      interimRef.current = '';
      setInterim('');
      if (!pending) return;
      // Dedupe deliberadamente CONSERVADOR: solo se descarta si el último final es exactamente ese
      // texto. Entre sesiones el motor resetea `results`, así que un `endsWith` daría falsos
      // positivos y se perdería transcripción legítima; mejor un duplicado raro que perderla.
      if (lastFinalRef.current === pending) return;
      onTranscriptRef.current(pending);
    };

    recognition.onstart = () => {
      setError(null);
      // Idempotente: en los reinicios ya vale `true`, React descarta el re-render y no parpadea.
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

      const finalText = finalChunk.trim();
      const interimText = interimChunk.trim();

      // Cualquier señal de voz —aunque sea provisional— reinicia el tope por tiempo.
      if (finalText || interimText) lastTranscriptAtRef.current = Date.now();

      if (interimText) {
        interimRef.current = interimText;
        setInterim(interimText);
      } else if (finalText) {
        // El motor cerró la frase: lo provisional ya está contenido en el final, se descarta.
        interimRef.current = '';
        setInterim('');
      }
      // Con ambos vacíos NO se toca el provisional: un `onresult` sin contenido no puede borrar
      // texto que todavía está pendiente de finalizarse o de volcarse.

      if (!finalText) return;
      lastFinalRef.current = finalText;
      // Hubo transcripción real: lo anterior no era un fallo, se perdonan los intentos fallidos.
      anomalousEndsRef.current = 0;
      startFailuresRef.current = 0;
      onTranscriptRef.current(finalText);
    };

    recognition.onerror = (event) => {
      switch (event.error) {
        case 'no-speech':
        case 'aborted':
          // Cierres NORMALES (silencio o detención manual). No cuentan como fallo: `onend` reanuda.
          return;
        case 'audio-capture':
          // Otro consumidor tiene el micrófono: se suelta la onda y se sigue transcribiendo.
          setCanVisualize(false);
          anomalousEndsRef.current += 1;
          setError(mapDictationError(event.error));
          return;
        case 'not-allowed':
        case 'service-not-allowed':
          // Permisos: no tiene sentido reintentar. Se cierra aquí mismo (sin esperar a `onend`, que
          // en la PWA de Android no siempre llega tras este error) con un aviso prominente.
          finish(PERMISSION_ERROR);
          return;
        default:
          anomalousEndsRef.current += 1;
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

      // Con `continuous = false` el motor cierra la sesión al terminar cada frase (y tras cada
      // silencio). Es el caso NORMAL: se reanuda sin contarlo como fallo. Solo se abandona por
      // fallos anómalos encadenados o por llevar demasiado tiempo sin oír absolutamente nada.
      if (anomalousEndsRef.current >= MAX_ANOMALOUS_ENDS) {
        finish({
          message: 'El dictado se interrumpió. Vuelve a pulsar el micrófono para continuar.',
          blocking: false,
        });
        return;
      }

      if (Date.now() - lastTranscriptAtRef.current >= SILENT_TIMEOUT_MS) {
        finish({
          message: 'El dictado se detuvo porque no se escuchó nada. Pulsa el micrófono para retomarlo.',
          blocking: false,
        });
        return;
      }

      scheduleRestart(
        anomalousEndsRef.current > 0 ? ANOMALOUS_RESTART_DELAY_MS : RESTART_DELAY_MS,
      );
    };

    // Se registra ANTES de arrancar: si `beginSession` acaba en `finish`, este debe poder anular la
    // referencia (si se asignara después, se resucitaría una sesión ya cerrada).
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
