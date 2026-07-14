import type { ReactNode } from 'react';

/* -------------------------------------------------------------------------- */
/* Primitivas compartidas de la Ayuda (QL-126)                                */
/* -------------------------------------------------------------------------- */
/**
 * Bloques reutilizables por todas las secciones de la Ayuda. Se extraen aquí para que cada
 * pestaña viva en su propio archivo sin duplicar el markup de tarjeta/rejilla. Contenido
 * 100% estático (sin TanStack Query); estilos con tokens Material 3 (claro/oscuro).
 */

interface SectionProps {
  icon: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
}

/** Tarjeta de sección con icono, título y descripción. */
export function Section({ icon, title, description, children }: SectionProps) {
  return (
    <section className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5 md:p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-on-surface">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm text-on-surface-variant">{description}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

export interface HelpFeature {
  icon: ReactNode;
  term: string;
  desc: ReactNode;
}

/**
 * Rejilla de "funciones" (icono + término + descripción). Es el patrón que ya usaba el Muro
 * (`WALL_TOPICS`); lo reutilizan Tareas, Tablero, Muro y Notificaciones para no repetir markup.
 */
export function FeatureList({ items }: { items: HelpFeature[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 sm:gap-x-8 lg:grid-cols-3">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-container-high">
            {item.icon}
          </span>
          <div className="min-w-0">
            <p className="font-medium text-on-surface">{item.term}</p>
            <p className="text-sm text-on-surface-variant">{item.desc}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export interface HelpConcept {
  term: string;
  icon: ReactNode;
  desc: ReactNode;
}

/** Rejilla de tarjetas con borde (definición de conceptos). Reutilizada por Conceptos. */
export function ConceptGrid({ items }: { items: HelpConcept[] }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((c) => (
        <div
          key={c.term}
          className="rounded-lg border border-outline-variant/40 bg-surface-container-low p-4"
        >
          <dt className="flex items-center gap-2 font-medium text-on-surface">
            {c.icon}
            {c.term}
          </dt>
          <dd className="mt-1 text-sm text-on-surface-variant">{c.desc}</dd>
        </div>
      ))}
    </dl>
  );
}
