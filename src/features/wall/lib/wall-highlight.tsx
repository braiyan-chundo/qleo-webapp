import { Fragment, type ReactNode } from 'react';

/**
 * Resalta (de forma **sencilla**, QL-119) todas las apariciones de `term` dentro de `text`,
 * envolviéndolas en `<mark>` con tokens M3. Case-insensitive; escapa los metacaracteres de
 * regex de `term` para tratarlo como texto literal (mismo criterio que el backend). Si `term`
 * está vacío devuelve el texto tal cual.
 */
export function highlightTerm(text: string, term: string): ReactNode {
  const needle = term.trim();
  if (needle.length === 0) return text;

  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'ig'));

  return parts.map((part, index) =>
    part.toLowerCase() === needle.toLowerCase() ? (
      <mark key={index} className="rounded bg-primary/20 text-on-surface">
        {part}
      </mark>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  );
}
