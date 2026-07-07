import type { CommentMention } from '../services/comments.service';

/** Token `@algo` que el usuario está escribiendo justo antes del caret. */
export interface ActiveMentionToken {
  /** Índice donde empieza la `@` (inclusive). */
  start: number;
  /** Índice del caret (exclusive) = fin del token. */
  end: number;
  /** Texto tras la `@` (lo escrito hasta el caret), para el typeahead. */
  query: string;
}

/**
 * Detecta si el caret está dentro de un token de mención `@algo`. Se considera activo si
 * hay una `@` precedida por inicio de texto o un espacio/salto de línea, y entre esa `@`
 * y el caret no hay espacios ni saltos de línea. Devuelve `null` si no hay token activo.
 */
export function findActiveMention(
  value: string,
  caret: number,
): ActiveMentionToken | null {
  // Retrocede desde el caret buscando la `@` que abre el token.
  let i = caret - 1;
  while (i >= 0) {
    const ch = value[i];
    if (ch === '@') {
      const prev = i > 0 ? value[i - 1] : '';
      // La `@` debe abrir palabra: inicio de texto o precedida por espacio/salto.
      if (i === 0 || prev === ' ' || prev === '\n' || prev === '\t') {
        return { start: i, end: caret, query: value.slice(i + 1, caret) };
      }
      return null;
    }
    if (ch === ' ' || ch === '\n' || ch === '\t') return null;
    i -= 1;
  }
  return null;
}

/**
 * Reemplaza el token activo `@algo` por `@Nombre ` (con espacio final) e informa la nueva
 * posición del caret. El nombre se normaliza colapsando espacios internos para que el
 * resaltado por texto sea estable.
 */
export function applyMention(
  value: string,
  token: ActiveMentionToken,
  name: string,
): { text: string; caret: number } {
  const mentionText = `@${name} `;
  const text = value.slice(0, token.start) + mentionText + value.slice(token.end);
  return { text, caret: token.start + mentionText.length };
}

/**
 * Recalcula qué menciones siguen referenciadas en el `body`: conserva solo aquellas cuyo
 * `@Nombre` aún aparece como palabra en el texto. Robusto ante ediciones manuales (si el
 * usuario borró el `@Nombre`, su userId ya no se envía). Devuelve los userIds únicos.
 */
export function resolveMentionIds(
  body: string,
  candidates: CommentMention[],
): string[] {
  const ids = new Set<string>();
  for (const mention of candidates) {
    if (bodyMentions(body, mention.name)) ids.add(mention.id);
  }
  return [...ids];
}

/** ¿El `body` contiene `@Nombre` como token (precedido por inicio/espacio)? */
export function bodyMentions(body: string, name: string): boolean {
  const needle = `@${name}`;
  let from = 0;
  for (;;) {
    const idx = body.indexOf(needle, from);
    if (idx === -1) return false;
    const prev = idx > 0 ? body[idx - 1] : '';
    if (idx === 0 || prev === ' ' || prev === '\n' || prev === '\t') return true;
    from = idx + 1;
  }
}
