import { useCallback, useRef, useState, type ClipboardEvent } from 'react';
import { toast } from 'sonner';
import { Loader2, Paperclip, Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { PendingAttachmentChip } from '@/features/attachments/components/PendingAttachmentChip';
import {
  useDeleteAttachment,
  useUploadAttachment,
} from '@/features/attachments/hooks/use-attachments';
import { filesFromClipboard } from '@/features/attachments/lib/clipboard';
import {
  ACCEPT_ATTR,
  MAX_UPLOAD_LABEL,
  notifyAttachmentError,
  validateFile,
} from '@/features/attachments/lib/files';
import {
  nextPendingKey,
  type PendingAttachment,
} from '@/features/attachments/lib/pending-upload';

import type { CommentMention } from '../services/comments.service';
import { useAddComment } from '../hooks/use-comments';
import { resolveMentionIds } from '../lib/mentions';
import { MentionTextarea } from './MentionTextarea';

interface CommentComposerProps {
  taskId: string;
  /** Traduce un fallo del alta de comentario a un toast (lo aporta el panel, §3.9). */
  onError: (err: unknown, fallback: string) => void;
}

/**
 * Caja de comentar del hilo de tarea (QL-12), ampliada en **QL-174/QL-175**: además del texto
 * con @menciones acepta **adjuntos**, tanto por el botón del clip como **pegándolos** desde el
 * portapapeles (Ctrl+V).
 *
 * Modelo de adjuntos (decisión de producto): el archivo se sube como adjunto de la **TAREA**
 * (`POST /tasks/:taskId/attachments`, `scope: 'task'`) y el comentario solo **referencia** su id
 * vía `attachmentIds`. Consecuencias aceptadas: el archivo aparece también en el panel de
 * Adjuntos de la tarea y **borrar el comentario no borra el archivo**.
 *
 * ⚠️ El **texto sigue siendo obligatorio** (decisión del cliente): no existe el comentario
 * solo-adjunto, así que "Comentar" permanece deshabilitado sin texto aunque haya archivos, con
 * un hint que lo explica.
 */
export function CommentComposer({ taskId, onError }: CommentComposerProps) {
  const addComment = useAddComment(taskId);
  const uploadAttachment = useUploadAttachment(taskId);
  const removeAttachment = useDeleteAttachment(taskId);

  const [draft, setDraft] = useState('');
  const [uploads, setUploads] = useState<PendingAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Candidatos de mención elegidos en el picker. Se filtran al enviar por si el usuario borró
  // el `@Nombre` del texto (ver `resolveMentionIds`).
  const mentionCandidates = useRef<CommentMention[]>([]);

  const registerMention = useCallback((mention: CommentMention) => {
    if (!mentionCandidates.current.some((m) => m.id === mention.id)) {
      mentionCandidates.current.push(mention);
    }
  }, []);

  const patchSlot = useCallback((key: string, patch: Partial<PendingAttachment>) => {
    setUploads((prev) => prev.map((u) => (u.key === key ? { ...u, ...patch } : u)));
  }, []);

  const removeSlot = useCallback(
    (slot: PendingAttachment) => {
      if (slot.previewUrl) URL.revokeObjectURL(slot.previewUrl);
      // Si ya se subió y aún no se publicó el comentario, el adjunto queda huérfano en la
      // tarea: se borra en el backend (best-effort, mismo criterio que el muro).
      if (slot.attachment) removeAttachment.mutate(slot.attachment.id);
      setUploads((prev) => prev.filter((u) => u.key !== slot.key));
    },
    [removeAttachment],
  );

  /** Valida (50 MB + lista blanca de MIME) y sube cada archivo elegido o pegado. */
  const handleFiles = (fileList: FileList | File[] | null) => {
    if (!fileList || fileList.length === 0) return;
    for (const file of Array.from(fileList)) {
      const invalid = validateFile(file);
      if (invalid) {
        toast.error(invalid.message);
        continue;
      }
      const key = nextPendingKey('comment-upload');
      const isImage = file.type.startsWith('image/');
      const previewUrl = isImage ? URL.createObjectURL(file) : undefined;
      setUploads((prev) => [
        ...prev,
        { key, name: file.name, isImage, previewUrl, status: 'uploading' },
      ]);
      uploadAttachment.mutate(file, {
        onSuccess: (attachment) => patchSlot(key, { status: 'done', attachment }),
        onError: (err) => {
          patchSlot(key, { status: 'error' });
          notifyAttachmentError(err, 'No se pudo subir el archivo');
        },
      });
    }
  };

  /**
   * (QL-175) Pegado: si el portapapeles trae ficheros se adjuntan y se corta el pegado por
   * defecto; si solo trae texto, no se toca nada (el pegado normal sigue funcionando).
   */
  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = filesFromClipboard(e.clipboardData);
    if (files.length === 0) return;
    e.preventDefault();
    handleFiles(files);
  };

  const body = draft.trim();
  const isUploading = uploads.some((u) => u.status === 'uploading');
  const canSubmit = body.length > 0 && !addComment.isPending && !isUploading;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const mentions = resolveMentionIds(body, mentionCandidates.current);
    // `flatMap` en vez de `filter` + cast: así el tipo de `attachment` se estrecha de verdad.
    const attachmentIds = uploads.flatMap((u) =>
      u.status === 'done' && u.attachment ? [u.attachment.id] : [],
    );
    addComment.mutate(
      {
        body,
        mentions: mentions.length ? mentions : undefined,
        attachmentIds: attachmentIds.length ? attachmentIds : undefined,
      },
      {
        onSuccess: () => {
          for (const slot of uploads) {
            if (slot.previewUrl) URL.revokeObjectURL(slot.previewUrl);
          }
          setUploads([]);
          setDraft('');
          mentionCandidates.current = [];
        },
        onError: (err) => onError(err, 'No se pudo publicar el comentario'),
      },
    );
  };

  return (
    <div className="mt-4 space-y-2">
      {uploads.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {uploads.map((slot) => (
            <PendingAttachmentChip
              key={slot.key}
              slot={slot}
              onRemove={() => removeSlot(slot)}
            />
          ))}
        </div>
      )}

      <MentionTextarea
        value={draft}
        onChange={setDraft}
        onMention={registerMention}
        onPaste={handlePaste}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        placeholder="Escribe un comentario… usa @ para mencionar"
        rows={3}
        disabled={addComment.isPending}
      />

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

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={addComment.isPending}
        >
          <Paperclip />
          Adjuntar
        </Button>
        <div className="flex items-center gap-2">
          {/* El texto es obligatorio incluso con adjuntos: se dice, no se deja adivinar. */}
          {uploads.length > 0 && body.length === 0 && (
            <span className="text-xs text-on-surface-variant">
              Escribe un texto para poder enviar
            </span>
          )}
          <Button type="button" size="sm" onClick={handleSubmit} disabled={!canSubmit}>
            {addComment.isPending ? <Loader2 className="animate-spin" /> : <Send />}
            Comentar
          </Button>
        </div>
      </div>

      <p className="text-[11px] text-on-surface-variant">
        Adjunta archivos con el clip o pégalos con Ctrl+V (máx {MAX_UPLOAD_LABEL}). Se guardan
        también en los adjuntos de la tarea.
      </p>
    </div>
  );
}
