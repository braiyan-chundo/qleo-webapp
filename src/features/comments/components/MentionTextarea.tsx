import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { Loader2, Megaphone } from 'lucide-react';

import { useUserDirectory } from '@/features/users/hooks/use-users';
import { AuthedAvatar } from '@/shared/components/AuthedAvatar';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

import type { CommentMention } from '../services/comments.service';
import { applyMention, findActiveMention, type ActiveMentionToken } from '../lib/mentions';

/** Handle imperativo para que el padre pueda enfocar el textarea o insertar en el caret. */
export interface MentionTextareaHandle {
  focus: () => void;
  /**
   * Inserta `text` en la posición actual del caret (reemplazando la selección), notifica el
   * nuevo valor vía `onChange` y recoloca el caret tras lo insertado. Usado por el picker de
   * emojis del muro (QL-90). Si no hay caret conocido, añade al final.
   */
  insertAtCaret: (text: string) => void;
}

/**
 * (QL-167) Entrada **especial** del dropdown de `@` que NO es un usuario: al elegirla inserta un
 * texto literal (`@<insertName> `) en el body y **no** registra ninguna mención (no llama a
 * `onMention`), así que su token nunca entra en `mentions`/userIds. La usa el composer del Muro
 * para ofrecer "@muro — Difusión a todos" al tope de la lista.
 */
export interface MentionExtraOption {
  /** Clave estable para el `key` y la selección. */
  id: string;
  /** Texto principal mostrado en la opción. */
  label: string;
  /** Descripción secundaria opcional. */
  description?: string;
  /** Texto tras la `@` que se inserta literalmente (p. ej. `'muro'` → `@muro `). NO es un userId. */
  insertName: string;
  /** Palabra clave (minúsculas) para el typeahead: se muestra si es prefijo de lo escrito tras `@`. */
  keyword: string;
}

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  /** Se llama al elegir a alguien del dropdown, para que el padre registre el userId. */
  onMention: (mention: CommentMention) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  /** Se llama al perder el foco el textarea (además del cierre interno del dropdown de menciones). */
  onBlur?: () => void;
  /**
   * (QL-167) Entradas especiales (no-usuario) que se muestran al **tope** del dropdown de `@`,
   * antes de los resultados del directorio. Insertan texto literal sin registrar mención.
   */
  extraOptions?: MentionExtraOption[];
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
    {
      value,
      onChange,
      onMention,
      onKeyDown,
      onBlur,
      extraOptions,
      placeholder,
      rows = 3,
      disabled,
      autoFocus,
      className,
    },
    ref,
  ) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [token, setToken] = useState<ActiveMentionToken | null>(null);
    const [highlight, setHighlight] = useState(0);

    // Auto-expansión vertical (tipo `Textarea` de shadcn): el textarea crece con el contenido y,
    // al topar con su `max-height` (CSS), scrollea. Lo resolvemos por JS para ser deterministas y
    // cross-browser. **Importante:** desactivamos `field-sizing` (el componente base trae
    // `field-sizing-content`), porque combinado con el `height` explícito descuadra la medición
    // de `scrollHeight`; con `field-sizing:fixed` el patrón clásico (auto → scrollHeight) mide bien.
    useLayoutEffect(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.setProperty('field-sizing', 'fixed');
      // Vacío → altura natural (min-height del CSS). Si midiéramos `scrollHeight` en vacío antes de
      // que el layout flex asigne el ancho, el placeholder (largo) se envolvería en muchas líneas e
      // inflaría la caja, dejándola "atascada" alta. Solo crecemos con contenido real.
      if (value.length === 0) {
        el.style.height = '';
        return;
      }
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }, [value]);

    useImperativeHandle(
      ref,
      () => ({
        focus: () => textareaRef.current?.focus(),
        insertAtCaret: (text: string) => {
          const el = textareaRef.current;
          if (!el) {
            onChange(value + text);
            return;
          }
          const start = el.selectionStart ?? value.length;
          const end = el.selectionEnd ?? value.length;
          const next = value.slice(0, start) + text + value.slice(end);
          onChange(next);
          // Recoloca el caret tras el texto insertado en el próximo frame (post-render).
          requestAnimationFrame(() => {
            const node = textareaRef.current;
            if (!node) return;
            node.focus();
            const caret = start + text.length;
            node.setSelectionRange(caret, caret);
          });
        },
      }),
      [value, onChange],
    );

    const query = token?.query ?? '';
    const open = token !== null;
    const { data: users, isLoading } = useUserDirectory(query, { enabled: open });
    const results = open ? (users ?? []) : [];
    // (QL-167) Entradas especiales que casan con lo escrito tras `@` (prefijo). Van al tope de la
    // lista; la navegación por teclado las trata como opciones 0..extras.length-1 (antes de los
    // usuarios). Vacío para todos los consumidores que no pasan `extraOptions` (p. ej. comentarios).
    const extras = open
      ? (extraOptions ?? []).filter((o) => o.keyword.startsWith(query.toLowerCase()))
      : [];
    const navCount = extras.length + results.length;

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

    const restoreCaret = (caret: number) => {
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(caret, caret);
        }
      });
    };

    const select = (mention: CommentMention) => {
      if (!token) return;
      const { text, caret } = applyMention(value, token, mention.name);
      onChange(text);
      onMention(mention);
      setToken(null);
      // Restaura foco y caret tras el reemplazo.
      restoreCaret(caret);
    };

    // (QL-167) Inserta el texto literal de una entrada especial (`@<insertName> `) reutilizando
    // `applyMention`, pero SIN llamar a `onMention`: así el token nunca se registra como mención
    // y `resolveMentionIds` no lo tratará como userId.
    const selectExtra = (option: MentionExtraOption) => {
      if (!token) return;
      const { text, caret } = applyMention(value, token, option.insertName);
      onChange(text);
      setToken(null);
      restoreCaret(caret);
    };

    /** Elige la opción resaltada de la lista unificada (extras primero, luego usuarios). */
    const selectAt = (index: number) => {
      if (index < extras.length) selectExtra(extras[index]);
      else select(results[index - extras.length]);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (open && navCount > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setHighlight((h) => (h + 1) % navCount);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setHighlight((h) => (h - 1 + navCount) % navCount);
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          selectAt(highlight);
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
            onBlur?.();
          }}
          onKeyDown={handleKeyDown}
        />

        {open && (
          // Ancho **propio** del desplegable (no depende del texto escrito): mínimo fijo y tope
          // consistente, anclado al inicio del textarea, sin desbordar en pantallas estrechas.
          // Se abre **hacia arriba** (`bottom-full`) porque el composer vive al fondo del muro:
          // hacia abajo la lista quedaba cortada por el borde inferior de la pantalla.
          <div className="absolute bottom-full left-0 z-50 mb-1 w-full min-w-64 max-w-[min(20rem,calc(100vw-2rem))] max-h-56 overflow-y-auto rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-1 shadow-md elevation-2">
            {/* (QL-167) Entradas especiales (no-usuario) al tope, p. ej. "@muro — Difusión". */}
            {extras.map((option, index) => (
              <button
                key={option.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectExtra(option);
                }}
                onMouseEnter={() => setHighlight(index)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
                  index === highlight
                    ? 'bg-surface-container-low'
                    : 'hover:bg-surface-container-low',
                )}
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-tertiary-container text-on-tertiary-container">
                  <Megaphone className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-on-surface">{option.label}</span>
                  {option.description && (
                    <span className="block truncate text-xs text-on-surface-variant">
                      {option.description}
                    </span>
                  )}
                </span>
              </button>
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 px-2 py-2 text-xs text-on-surface-variant">
                <Loader2 className="size-3.5 animate-spin" />
                Buscando…
              </div>
            )}
            {!isLoading && results.length === 0 && extras.length === 0 && (
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
                  onMouseEnter={() => setHighlight(extras.length + index)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
                    extras.length + index === highlight
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
