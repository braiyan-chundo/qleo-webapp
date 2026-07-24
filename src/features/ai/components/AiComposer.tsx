import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { ArrowUp, Loader2, Mic, MicOff, Square } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useSpeechDictation } from '../hooks/use-speech-dictation';
import { AudioWaveform } from './AudioWaveform';

interface AiComposerProps {
  onSend: (text: string) => void;
  /** `true` mientras hay un turno en vuelo: no se puede enviar otro. */
  busy: boolean;
}

/** Límite del backend para el mensaje (§3.63). */
const MAX_LENGTH = 4000;

/** Locale del dictado por voz (QL-191). Alineado con el idioma de la app; fácil de cambiar. */
const DICTATION_LANG = 'es-CO';

/**
 * Caja de entrada del chat de IA (QL-190). Enter envía, Shift+Enter hace salto de línea. Se
 * deshabilita el envío mientras hay un turno en curso o el texto está vacío. Incluye dictado por
 * voz (QL-191): la Web Speech API transcribe y anexa al texto para que el usuario lo revise y envíe.
 *
 * Móvil (QL-191 bugfix): al dictar NO se sustituye el textarea por la onda. La onda va como franja
 * compacta encima y el texto sigue a la vista (con el provisional del motor debajo), así el usuario
 * ve que funciona y el botón de enviar —siempre visible y pulsable— se habilita en cuanto entra la
 * primera transcripción.
 */
export function AiComposer({ onSend, busy }: AiComposerProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSend = value.trim().length > 0 && !busy;

  // Espejo del estado de dictado para `appendTranscript` (se lee en el momento de la llamada).
  const recordingRef = useRef(false);

  // El dictado solo ALIMENTA el texto: anexa cada fragmento final respetando el límite y sin
  // duplicar espacios. El envío sigue siendo manual (revisar-antes-de-enviar es intencional).
  const appendTranscript = useCallback((text: string) => {
    setValue((prev) => {
      const separator = prev.length > 0 && !prev.endsWith(' ') ? ' ' : '';
      return (prev + separator + text).slice(0, MAX_LENGTH);
    });
    // Enfocar en mitad del dictado abriría el teclado del móvil encima de la onda: se deja para el
    // final (al detener), donde el texto ya está listo para enviar.
    if (!recordingRef.current) textareaRef.current?.focus();
  }, []);

  const dictation = useSpeechDictation({ lang: DICTATION_LANG, onTranscript: appendTranscript });
  recordingRef.current = dictation.recording;

  // Al terminar el dictado, el foco vuelve al textarea con el texto listo para revisar y enviar.
  const wasRecordingRef = useRef(false);
  useEffect(() => {
    if (wasRecordingRef.current && !dictation.recording) textareaRef.current?.focus();
    wasRecordingRef.current = dictation.recording;
  }, [dictation.recording]);

  const submit = () => {
    if (!canSend) return;
    if (dictation.recording) dictation.stop();
    onSend(value);
    setValue('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div>
      <div className="rounded-2xl border border-outline-variant/50 bg-surface-container-low p-2 focus-within:border-primary/50">
        {dictation.recording && (
          // Franja compacta de "estoy escuchando": no ocupa el sitio del textarea ni del botón de
          // enviar, así que en móvil se sigue viendo (y pulsando) todo.
          <div className="mb-2 flex items-center gap-2 rounded-xl bg-error-container/40 px-2 py-1.5">
            <span className="size-2 shrink-0 animate-pulse rounded-full bg-error" aria-hidden="true" />
            <AudioWaveform active capture={dictation.canVisualize} className="min-w-0 flex-1" />
            <span className="shrink-0 text-xs font-medium text-error" role="status">
              Escuchando…
            </span>
          </div>
        )}

        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={MAX_LENGTH}
            rows={1}
            placeholder={
              dictation.recording
                ? 'Habla: el texto irá apareciendo aquí…'
                : 'Escribe tu consulta… (Enter para enviar, Shift+Enter para salto de línea)'
            }
            className="max-h-40 min-h-10 min-w-0 flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm shadow-none focus-visible:ring-0"
          />

          {dictation.supported && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                'size-10 shrink-0 rounded-xl',
                dictation.recording &&
                  'animate-pulse bg-error-container text-error hover:bg-error-container',
              )}
              onClick={dictation.toggle}
              aria-label={dictation.recording ? 'Detener dictado' : 'Dictar por voz'}
              aria-pressed={dictation.recording}
            >
              {dictation.recording ? <Square /> : <Mic />}
            </Button>
          )}

          <Button
            type="button"
            size="icon"
            className="size-10 shrink-0 rounded-xl"
            onClick={submit}
            disabled={!canSend}
            aria-label="Enviar mensaje"
          >
            {busy ? <Loader2 className="animate-spin" /> : <ArrowUp />}
          </Button>
        </div>

        {dictation.recording && dictation.interim.length > 0 && (
          // Provisional del motor: confirma que está transcribiendo aunque aún no haya texto final.
          <p className="px-2 pt-1 text-xs text-on-surface-variant" aria-live="polite">
            {dictation.interim}
          </p>
        )}
      </div>

      {dictation.error && (
        <p
          className={cn(
            'mt-1.5 flex items-start gap-2',
            dictation.error.blocking
              ? 'rounded-xl bg-error-container px-3 py-2 text-sm text-on-error-container'
              : 'px-1 text-xs text-error',
          )}
          role="alert"
        >
          {dictation.error.blocking && <MicOff className="mt-0.5 size-4 shrink-0" />}
          <span>{dictation.error.message}</span>
        </p>
      )}
    </div>
  );
}
