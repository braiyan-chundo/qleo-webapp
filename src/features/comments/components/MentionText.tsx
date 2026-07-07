import { Fragment } from 'react';

import type { CommentMention } from '../services/comments.service';

interface MentionTextProps {
  body: string;
  mentions: CommentMention[];
}

/**
 * Renderiza el cuerpo de un comentario resaltando las ocurrencias de `@<name>` de sus
 * menciones pobladas (QL-13). Ordena los nombres de más largo a más corto para no cortar
 * un nombre por otro que sea prefijo. Respeta `whitespace-pre-wrap`; si una mención no
 * matchea texto, simplemente no se resalta.
 */
export function MentionText({ body, mentions }: MentionTextProps) {
  if (mentions.length === 0) return <>{body}</>;

  const names = [...new Set(mentions.map((m) => m.name))].sort(
    (a, b) => b.length - a.length,
  );
  const pattern = new RegExp(`@(?:${names.map(escapeRegExp).join('|')})`, 'g');

  const parts: Array<{ text: string; isMention: boolean }> = [];
  let lastIndex = 0;
  for (const match of body.matchAll(pattern)) {
    const start = match.index;
    const prev = start > 0 ? body[start - 1] : '';
    // Solo resalta si abre palabra (inicio o espacio/salto antes de la `@`).
    if (start === lastIndex || start === 0 || prev === ' ' || prev === '\n' || prev === '\t') {
      if (start > lastIndex) parts.push({ text: body.slice(lastIndex, start), isMention: false });
      parts.push({ text: match[0], isMention: true });
      lastIndex = start + match[0].length;
    }
  }
  if (lastIndex < body.length) parts.push({ text: body.slice(lastIndex), isMention: false });

  return (
    <>
      {parts.map((part, i) =>
        part.isMention ? (
          <span key={i} className="font-medium text-primary">
            {part.text}
          </span>
        ) : (
          <Fragment key={i}>{part.text}</Fragment>
        ),
      )}
    </>
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
