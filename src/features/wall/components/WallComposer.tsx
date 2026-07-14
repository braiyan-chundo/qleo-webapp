import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { toast } from 'sonner';
import {
  Camera,
  Image as ImageIcon,
  Loader2,
  Mic,
  Paperclip,
  Plus,
  SendHorizontal,
  Trash2,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useIsMobile } from '@/hooks/use-mobile';
import type { CommentMention } from '@/features/comments/services/comments.service';
import {
  MentionTextarea,
  type MentionTextareaHandle,
} from '@/features/comments/components/MentionTextarea';
import { resolveMentionIds } from '@/features/comments/lib/mentions';
import type { Attachment } from '@/features/attachments/services/attachments.service';
import { AttachmentIcon } from '@/features/attachments/components/AttachmentIcon';
import { ACCEPT_ATTR, validateFile } from '@/features/attachments/lib/files';

import {
  useRemoveWallAttachment,
  useUploadWallAttachment,
  type SendWallMessageInput,
} from '../hooks/use-wall';
import { useVoiceRecorder } from '../hooks/use-voice-recorder';
import { useWallTyping } from '../hooks/use-wall-presence';
import { formatVoiceDuration } from '../lib/wall-audio';
import { notifyWallError } from '../lib/wall-errors';
import type { WallReplyPreview } from '../types/wall.types';
import { EmojiPicker } from './EmojiPicker';

/** Límite del backend (§3.25): body de máx 4000 chars. */
const MAX_LENGTH = 4000;

/** `accept` para las opciones de imagen/vídeo (galería / foto·vídeo) del menú de adjuntar. */
const ACCEPT_MEDIA = 'image/*,video/*';
/** `accept` para la cámara del móvil (solo imagen, con captura trasera). */
const ACCEPT_CAMERA = 'image/*';

/** Extensión de archivo para el MIME base de una nota de voz (QL-104). */
function voiceExtension(mimeType: string): string {
  switch (mimeType) {
    case 'audio/webm':
      return 'webm';
    case 'audio/ogg':
      return 'ogg';
    case 'audio/mp4':
      return 'm4a';
    case 'audio/mpeg':
      return 'mp3';
    default:
      return 'webm';
  }
}

interface WallComposerProps {
  /** Envía el mensaje (texto + menciones + adjuntos ya subidos). */
  onSend: (payload: SendWallMessageInput) => void;
  /** `true` mientras un envío está en vuelo → deshabilita el botón. */
  isSending: boolean;
  /** (QL-103) Cita del mensaje al que se responde, o `null` si no es una respuesta. */
  replyTo?: WallReplyPreview | null;
  /** (QL-103) Cancela la respuesta en curso (limpia la cita). */
  onCancelReply?: () => void;
}

/** Un adjunto en el composer: en subida, subido o fallido. */
interface PendingUpload {
  /** Clave local estable (para el keyed render y el borrado del slot). */
  key: string;
  name: string;
  isImage: boolean;
  /** Object URL local del archivo (solo imágenes) para la miniatura previa. */
  previewUrl?: string;
  status: 'uploading' | 'done' | 'error';
  /** `Attachment` devuelto por la subida previa (presente si `status === 'done'`). */
  attachment?: Attachment;
}

let slotCounter = 0;
const nextKey = () => `wall-upload-${Date.now()}-${(slotCounter += 1)}`;

/**
 * Barra de escritura del muro (QL-90, rediseño QL-95): barra redondeada con botón **"+"**
 * (adjuntar) a la izquierda, `MentionTextarea` (autocompletar `@`) en el centro y **emoji** +
 * **enviar** (botón circular primario) a la derecha; debajo, textos de ayuda ("Usa @ para
 * mencionar a alguien" / "Enter para enviar"). **Enter envía**, **Shift+Enter** salto de línea;
 * si el popover de menciones está abierto, Enter elige la mención (lo gestiona `MentionTextarea`,
 * que solo reenvía el Enter cuando el popover está cerrado). El botón enviar se habilita con
 * **texto O ≥1 adjunto** subido, y se bloquea mientras haya una subida en vuelo.
 */
export function WallComposer({
  onSend,
  isSending,
  replyTo = null,
  onCancelReply,
}: WallComposerProps) {
  const isMobile = useIsMobile();
  const [value, setValue] = useState('');
  const [uploads, setUploads] = useState<PendingUpload[]>([]);
  const editorRef = useRef<MentionTextareaHandle>(null);

  // Grabación de nota de voz (QL-104). `sendingVoice` cubre el tramo subir→enviar del audio.
  const voice = useVoiceRecorder();
  const [sendingVoice, setSendingVoice] = useState(false);

  // "Escribiendo…/grabando audio…" en vivo (QL-125): emite por el socket único del muro.
  const { startTyping, stopTyping } = useWallTyping();

  const isRecording = voice.status === 'recording';

  // Al iniciar/actualizar una respuesta, enfoca el editor para escribir de inmediato (QL-103).
  useEffect(() => {
    if (replyTo) editorRef.current?.focus();
  }, [replyTo]);

  // (QL-125) Emite "grabando un audio…" mientras la grabación está activa; corta al soltar/cancelar
  // o al enviar la nota (cuando `voice.status` vuelve a 'idle').
  useEffect(() => {
    if (isRecording) startTyping('audio');
    else stopTyping();
  }, [isRecording, startTyping, stopTyping]);

  // (QL-125) Al desmontar el composer (p. ej. alternar el panel de info en móvil) corta el
  // "escribiendo…" para no dejar el indicador colgado en el resto del equipo.
  useEffect(() => () => stopTyping(), [stopTyping]);
  // Un input file oculto por opción del menú (§QL-100): archivo general, galería/foto·vídeo y
  // cámara. Solo cambian `accept`/`capture`; todos vuelcan en el mismo `handleFiles`.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Radix cierra el menú tras `onSelect`; diferimos el `click` del input un frame para no perder
  // el gesto del usuario (algunos navegadores ignoran el click programático durante el cierre).
  const openInput = (inputRef: RefObject<HTMLInputElement | null>) => {
    requestAnimationFrame(() => inputRef.current?.click());
  };
  // Menciones elegidas en el picker; se filtran al enviar por si se borró el `@Nombre`.
  const mentionCandidates = useRef<CommentMention[]>([]);

  const uploadAttachment = useUploadWallAttachment();
  const removeAttachment = useRemoveWallAttachment();

  const trimmed = value.trim();
  const doneAttachments = uploads.filter((u) => u.status === 'done' && u.attachment);
  const isUploading = uploads.some((u) => u.status === 'uploading');
  const canSend = (trimmed.length > 0 || doneAttachments.length > 0) && !isSending && !isUploading;

  const registerMention = useCallback((mention: CommentMention) => {
    if (!mentionCandidates.current.some((m) => m.id === mention.id)) {
      mentionCandidates.current.push(mention);
    }
  }, []);

  const patchSlot = useCallback((key: string, patch: Partial<PendingUpload>) => {
    setUploads((prev) => prev.map((u) => (u.key === key ? { ...u, ...patch } : u)));
  }, []);

  const removeSlot = useCallback(
    (slot: PendingUpload) => {
      if (slot.previewUrl) URL.revokeObjectURL(slot.previewUrl);
      // Si ya se subió (adjunto huérfano), lo borramos en el backend (best-effort).
      if (slot.attachment) removeAttachment.mutate(slot.attachment.id);
      setUploads((prev) => prev.filter((u) => u.key !== slot.key));
    },
    [removeAttachment],
  );

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    for (const file of Array.from(fileList)) {
      const invalid = validateFile(file);
      if (invalid) {
        toast.error(invalid.message);
        continue;
      }
      const key = nextKey();
      const isImage = file.type.startsWith('image/');
      const previewUrl = isImage ? URL.createObjectURL(file) : undefined;
      setUploads((prev) => [
        ...prev,
        { key, name: file.name, isImage, previewUrl, status: 'uploading' },
      ]);
      uploadAttachment.mutate(
        { file },
        {
          onSuccess: (attachment) => patchSlot(key, { status: 'done', attachment }),
          onError: (err) => {
            patchSlot(key, { status: 'error' });
            notifyWallError(err, 'No se pudo subir el archivo');
          },
        },
      );
    }
  };

  const clear = () => {
    for (const slot of uploads) {
      if (slot.previewUrl) URL.revokeObjectURL(slot.previewUrl);
    }
    setUploads([]);
    setValue('');
    mentionCandidates.current = [];
    // (QL-125) Al enviar/vaciar deja de "escribir…": corta el heartbeat y emite `wall:typing:stop`.
    stopTyping();
  };

  // (QL-125) Cambio de texto: refleja el valor y emite/corta el "escribiendo…" según haya contenido.
  const handleTextChange = useCallback(
    (next: string) => {
      const clipped = next.slice(0, MAX_LENGTH);
      setValue(clipped);
      if (clipped.trim().length > 0) startTyping('text');
      else stopTyping();
    },
    [startTyping, stopTyping],
  );

  const submit = () => {
    if (!canSend) return;
    const mentions = resolveMentionIds(trimmed, mentionCandidates.current);
    onSend({
      body: trimmed,
      mentions,
      attachments: doneAttachments.map((u) => u.attachment as Attachment),
      replyTo: replyTo?.id,
      replyPreview: replyTo,
    });
    clear();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Solo llega aquí cuando el popover de menciones está cerrado (MentionTextarea filtra).
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  // ¿El botón derecho es "enviar" (hay contenido) o "micrófono" (composer vacío)? Estilo WhatsApp.
  const hasContent = trimmed.length > 0 || doneAttachments.length > 0;

  /** Inicia la grabación de una nota de voz; traduce los fallos comunes a un toast claro (QL-104). */
  const startVoice = async () => {
    try {
      await voice.start();
    } catch (err) {
      if (err instanceof Error && err.message === 'UNSUPPORTED') {
        toast.error('Tu navegador no permite grabar notas de voz.');
        return;
      }
      if (
        err instanceof DOMException &&
        (err.name === 'NotAllowedError' || err.name === 'SecurityError')
      ) {
        toast.error('Permiso de micrófono denegado. Actívalo para grabar notas de voz.');
        return;
      }
      toast.error('No se pudo acceder al micrófono.');
    }
  };

  /** Detiene, sube el audio con `durationSec` y lo envía como mensaje del muro (QL-104). */
  const stopAndSendVoice = async () => {
    const recording = await voice.stop();
    if (!recording) {
      toast.error('No se grabó audio.');
      return;
    }
    const ext = voiceExtension(recording.mimeType);
    const file = new File([recording.blob], `nota-de-voz-${Date.now()}.${ext}`, {
      type: recording.mimeType,
    });
    setSendingVoice(true);
    uploadAttachment.mutate(
      { file, durationSec: recording.durationSec },
      {
        onSuccess: (attachment) => {
          setSendingVoice(false);
          onSend({
            body: '',
            mentions: [],
            attachments: [attachment],
            replyTo: replyTo?.id,
            replyPreview: replyTo,
          });
        },
        onError: (err) => {
          setSendingVoice(false);
          notifyWallError(err, 'No se pudo enviar la nota de voz');
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-1.5 border-t border-outline-variant/40 bg-surface px-3 py-3 md:px-6">
      {/* Previsualización de adjuntos pendientes */}
      {uploads.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {uploads.map((slot) => (
            <ComposerAttachment key={slot.key} slot={slot} onRemove={() => removeSlot(slot)} />
          ))}
        </div>
      )}

      {/* Cita "respondiendo a…" (QL-103): autor + preview + cancelar, encima del composer. */}
      {replyTo && (
        <div className="flex items-center gap-2 rounded-lg border-l-2 border-primary bg-surface-container-low px-3 py-1.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-primary">
              Respondiendo a {replyTo.author.name}
            </p>
            <p className="truncate text-xs text-on-surface-variant">
              {replyTo.preview || 'Mensaje'}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 text-on-surface-variant"
            onClick={onCancelReply}
            aria-label="Cancelar respuesta"
          >
            <X className="size-4" />
          </Button>
        </div>
      )}

      {isRecording ? (
        /* Barra de grabación de nota de voz (QL-104): cancelar · indicador+tiempo · enviar. */
        <div className="flex items-center gap-2 rounded-3xl border border-outline-variant/50 bg-surface-container-low py-1.5 pl-2 pr-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={voice.cancel}
            aria-label="Cancelar grabación"
            className="size-9 shrink-0 rounded-full text-error hover:text-error"
          >
            <Trash2 className="size-5" />
          </Button>
          <div className="flex min-w-0 flex-1 items-center gap-2 px-1">
            <span className="size-2.5 shrink-0 animate-pulse rounded-full bg-error" aria-hidden />
            <span className="text-sm tabular-nums text-on-surface">
              {formatVoiceDuration(voice.seconds)}
            </span>
            <span className="truncate text-xs text-on-surface-variant">Grabando nota de voz…</span>
          </div>
          <Button
            type="button"
            size="icon"
            onClick={stopAndSendVoice}
            aria-label="Enviar nota de voz"
            className="size-9 shrink-0 rounded-full"
          >
            <SendHorizontal className="size-4" />
          </Button>
        </div>
      ) : (
      /* Barra redondeada: [+]  ·  textarea  ·  [emoji] [enviar/micrófono] */
      <div className="flex items-end gap-1 rounded-3xl border border-outline-variant/50 bg-surface-container-low py-1.5 pl-1.5 pr-2">
        {/* Inputs ocultos: uno por opción del menú, con su `accept`/`capture` propio. */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <input
          ref={mediaInputRef}
          type="file"
          multiple
          accept={ACCEPT_MEDIA}
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
        {isMobile && (
          <input
            ref={cameraInputRef}
            type="file"
            accept={ACCEPT_CAMERA}
            capture="environment"
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
        )}

        {/* Menú "+": opciones de adjuntar según el dispositivo (escritorio / móvil). */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={isSending}
              aria-label="Adjuntar"
              className="size-9 shrink-0 rounded-full text-on-surface-variant"
            >
              <Plus className="size-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-48">
            <DropdownMenuItem onSelect={() => openInput(fileInputRef)}>
              <Paperclip className="size-4" />
              Archivo
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openInput(mediaInputRef)}>
              <ImageIcon className="size-4" />
              {isMobile ? 'Galería' : 'Foto o vídeo'}
            </DropdownMenuItem>
            {isMobile && (
              <DropdownMenuItem onSelect={() => openInput(cameraInputRef)}>
                <Camera className="size-4" />
                Cámara
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Zona de texto que crece (flex-1); el textarea auto-expande su alto hasta `max-h-40`. */}
        <div className="min-w-0 flex-1">
          <MentionTextarea
            ref={editorRef}
            value={value}
            onChange={handleTextChange}
            onMention={registerMention}
            onKeyDown={handleKeyDown}
            onBlur={stopTyping}
            rows={1}
            placeholder="Escribe un mensaje al Muro Corporativo…"
            className="max-h-40 min-h-9 w-full resize-none border-0 bg-transparent px-1 py-1.5 shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent"
          />
        </div>

        {/* Emoji + enviar/micrófono: SIEMPRE pegados al extremo derecho y al fondo (la barra usa
            `items-end`), sin moverse cuando el texto crece hacia arriba. Con contenido → enviar;
            vacío → micrófono para grabar una nota de voz (QL-104, estilo WhatsApp). */}
        <div className="flex shrink-0 items-end gap-1">
          <EmojiPicker
            disabled={isSending}
            onSelect={(emoji) => editorRef.current?.insertAtCaret(emoji)}
          />

          {hasContent ? (
            <Button
              type="button"
              size="icon"
              onClick={submit}
              disabled={!canSend}
              aria-label="Enviar mensaje"
              className="size-9 shrink-0 rounded-full"
            >
              {isSending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <SendHorizontal className="size-4" />
              )}
            </Button>
          ) : (
            <Button
              type="button"
              size="icon"
              onClick={startVoice}
              disabled={isSending || isUploading || sendingVoice}
              aria-label="Grabar nota de voz"
              className="size-9 shrink-0 rounded-full text-on-surface-variant"
              variant="ghost"
            >
              {sendingVoice ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Mic className="size-5" />
              )}
            </Button>
          )}
        </div>
      </div>
      )}

      {/* Ayudas: mención (izq.) y atajo de envío (der.) */}
      <div className="flex items-center justify-between px-3 text-[11px] text-on-surface-variant">
        <span>
          Usa <span className="font-semibold">@</span> para mencionar a alguien
        </span>
        <span className="hidden sm:inline">Enter para enviar</span>
      </div>
    </div>
  );
}

interface ComposerAttachmentProps {
  slot: PendingUpload;
  onRemove: () => void;
}

/** Miniatura (imágenes) o chip (archivos) de un adjunto pendiente, con botón de quitar. */
function ComposerAttachment({ slot, onRemove }: ComposerAttachmentProps) {
  const uploading = slot.status === 'uploading';
  const error = slot.status === 'error';

  return (
    <div className="group/att relative flex items-center gap-2 rounded-md border border-outline-variant/40 bg-surface-container-low p-1 pr-2">
      {slot.isImage && slot.previewUrl ? (
        <span className="relative size-11 shrink-0 overflow-hidden rounded">
          <img src={slot.previewUrl} alt={slot.name} className="size-full object-cover" />
          {uploading && (
            <span className="absolute inset-0 flex items-center justify-center bg-surface/70">
              <Loader2 className="size-4 animate-spin text-primary" />
            </span>
          )}
        </span>
      ) : (
        <span className="flex size-9 shrink-0 items-center justify-center rounded bg-surface-container-high">
          {uploading ? (
            <Loader2 className="size-4 animate-spin text-on-surface-variant" />
          ) : (
            <AttachmentIcon mimeType={slot.isImage ? 'image/*' : 'application/octet-stream'} />
          )}
        </span>
      )}

      <div className="min-w-0 max-w-[9rem]">
        <p className="truncate text-xs font-medium text-on-surface" title={slot.name}>
          {slot.name}
        </p>
        <p className="text-[11px] text-on-surface-variant">
          {error ? 'Error' : uploading ? 'Subiendo…' : 'Listo'}
        </p>
      </div>

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Quitar ${slot.name}`}
        className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant transition-colors hover:bg-error-container hover:text-on-error-container"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
