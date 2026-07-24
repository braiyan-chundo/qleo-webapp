import { useCallback, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { ArrowUp, Loader2, Mic, Square } from 'lucide-react';

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
 */
export function AiComposer({ onSend, busy }: AiComposerProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSend = value.trim().length > 0 && !busy;

  // El dictado solo ALIMENTA el texto: anexa cada fragmento final respetando el límite y sin
  // duplicar espacios. El envío sigue siendo manual (revisar-antes-de-enviar es intencional).
  const appendTranscript = useCallback((text: string) => {
    setValue((prev) => {
      const separator = prev.length > 0 && !prev.endsWith(' ') ? ' ' : '';
      return (prev + separator + text).slice(0, MAX_LENGTH);
    });
    textareaRef.current?.focus();
  }, []);

  const dictation = useSpeechDictation({ lang: DICTATION_LANG, onTranscript: appendTranscript });

  const submit = () => {
    if (!canSend) return;
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
      <div className="flex items-end gap-2 rounded-2xl border border-outline-variant/50 bg-surface-container-low p-2 focus-within:border-primary/50">
        {dictation.recording ? (
          // Mientras se dicta, la caja se convierte en una onda en vivo ("está escuchando"). El texto
          // transcrito se sigue acumulando en `value` y reaparece en el textarea al detener.
          <AudioWaveform active={dictation.recording} />
        ) : (
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={MAX_LENGTH}
            rows={1}
            placeholder="Escribe tu consulta… (Enter para enviar, Shift+Enter para salto de línea)"
            className="max-h-40 min-h-10 flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm shadow-none focus-visible:ring-0"
          />
        )}

        {dictation.supported && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              'size-10 shrink-0 rounded-xl',
              dictation.recording && 'animate-pulse bg-error-container text-error hover:bg-error-container',
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

      {dictation.error && (
        <p className="mt-1.5 px-1 text-xs text-error" role="alert">
          {dictation.error}
        </p>
      )}
    </div>
  );
}
