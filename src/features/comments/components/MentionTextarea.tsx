import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { Loader2 } from 'lucide-react';

import { useUserDirectory } from '@/features/users/hooks/use-users';
import { AuthedAvatar } from '@/shared/components/AuthedAvatar';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

import type { CommentMention } from '../services/comments.service';
import { applyMention, findActiveMention, type ActiveMentionToken } from '../lib/mentions';

/** Handle imperativo para que el padre pueda enfocar el textarea. */
export interface MentionTextareaHandle {
  focus: () => void;
}

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  /** Se llama al elegir a alguien del dropdown, para que el padre registre el userId. */
  onMention: (mention: CommentMention) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}

/**
 * Textarea con autocompletar de @menciones inline (QL-13). Detecta un token `@algo` en el
 * caret, consulta `GET /users/directory` y muestra un dropdown flotante; al elegir,
 * reemplaza el token por `@Nombre ` e informa al padre el usuario elegido. Reutilizable en
 * la caja de comentar y en la edición en línea.
 */
export const MentionTextarea = forwardRef<MentionTextareaHandle, MentionTextareaProps>(
  function MentionTextarea(
    { value, onChange, onMention, onKeyDown, placeholder, rows = 3, disabled, autoFocus, className },
    ref,
  ) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [token, setToken] = useState<ActiveMentionToken | null>(null);
    const [highlight, setHighlight] = useState(0);

    useImperativeHandle(ref, () => ({ focus: () => textareaRef.current?.focus() }), []);

    const query = token?.query ?? '';
    const open = token !== null;
    const { data: users, isLoading } = useUserDirectory(query, { enabled: open });
    const results = open ? (users ?? []) : [];

    const syncToken = (nextValue: string, caret: number | null) => {
      if (caret == null) {
        setToken(null);
        return;
      }
      const found = findActiveMention(nextValue, caret);
      setToken(found);
      setHighlight(0);
    };

    const handleChange = (next: string, caret: number | null) => {
      onChange(next);
      syncToken(next, caret);
    };

    const select = (mention: CommentMention) => {
      if (!token) return;
      const { text, caret } = applyMention(value, token, mention.name);
      onChange(text);
      onMention(mention);
      setToken(null);
      // Restaura foco y caret tras el reemplazo.
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(caret, caret);
        }
      });
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (open && results.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setHighlight((h) => (h + 1) % results.length);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setHighlight((h) => (h - 1 + results.length) % results.length);
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          select(results[highlight]);
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setToken(null);
          return;
        }
      }
      onKeyDown?.(e);
    };

    return (
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={value}
          rows={rows}
          disabled={disabled}
          autoFocus={autoFocus}
          placeholder={placeholder}
          className={className}
          onChange={(e) => handleChange(e.target.value, e.target.selectionStart)}
          onClick={(e) => syncToken(value, e.currentTarget.selectionStart)}
          onKeyUp={(e) => {
            if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
              syncToken(value, e.currentTarget.selectionStart);
            }
          }}
          onBlur={() => {
            // Retraso para permitir el click en una opción antes de cerrar.
            window.setTimeout(() => setToken(null), 120);
          }}
          onKeyDown={handleKeyDown}
        />

        {open && (
          <div className="absolute left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-1 shadow-md elevation-2">
            {isLoading && (
              <div className="flex items-center gap-2 px-2 py-2 text-xs text-on-surface-variant">
                <Loader2 className="size-3.5 animate-spin" />
                Buscando…
              </div>
            )}
            {!isLoading && results.length === 0 && (
              <p className="px-2 py-2 text-xs text-on-surface-variant">
                Sin resultados
              </p>
            )}
            {!isLoading &&
              results.map((entry, index) => (
                <button
                  key={entry.id}
                  type="button"
                  // onMouseDown evita el blur antes del click.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    select({ id: entry.id, name: entry.name, avatarUrl: entry.avatarUrl });
                  }}
                  onMouseEnter={() => setHighlight(index)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
                    index === highlight
                      ? 'bg-surface-container-low'
                      : 'hover:bg-surface-container-low',
                  )}
                >
                  <AuthedAvatar
                    size="sm"
                    className="size-6 shrink-0"
                    avatarDownloadUrl={entry.avatarDownloadUrl}
                    avatarUrl={entry.avatarUrl}
                    name={entry.name}
                    fallbackClassName="text-[10px]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-on-surface">{entry.name}</span>
                    <span className="block truncate text-xs text-on-surface-variant">
                      {entry.email}
                    </span>
                  </span>
                </button>
              ))}
          </div>
        )}
      </div>
    );
  },
);
