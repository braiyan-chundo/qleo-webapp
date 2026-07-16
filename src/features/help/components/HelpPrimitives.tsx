import type { ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

import { useIsAdmin } from '../hooks/use-is-admin';

/* -------------------------------------------------------------------------- */
/* Primitivas compartidas de la Ayuda (QL-126 · QL-128)                        */
/* -------------------------------------------------------------------------- */
/**
 * Bloques reutilizables por todas las secciones de la Ayuda. Se extraen aquí para que cada
 * pestaña viva en su propio archivo sin duplicar el markup de tarjeta/rejilla. Contenido
 * estático (sin TanStack Query); estilos con tokens Material 3 (claro/oscuro).
 *
 * **Adaptación por rol (QL-128).** Las primitivas aceptan `adminOnly` y resuelven el rol
 * por su cuenta (`useIsAdmin`), para no repetir condicionales en cada sección. La regla es
 * una sola y se cumple en los dos sentidos:
 *
 * - a un **MEMBER** se le **oculta** lo marcado `adminOnly` (no debe leer cómo hacer algo
 *   que no puede hacer);
 * - a un **ADMIN** se le muestra con el badge «Solo administradores», para que sepa qué ve
 *   —y qué no ve— un miembro.
 *
 * Invariante: `adminOnly` ⇔ oculto para un MEMBER. Si algo lo ve todo el mundo, **no** se
 * marca (marcarlo mentiría sobre quién lo ve). Ejemplo real: los mensajes fijados del muro
 * los ve cualquiera, aunque solo un ADMIN pueda fijarlos → ese ítem NO es `adminOnly`.
 */

/** Marca discreta de lo que solo ve (y solo puede) un ADMIN de plataforma. */
export function AdminOnlyBadge() {
  return (
    <Badge
      variant="outline"
      className="border-outline-variant/60 text-on-surface-variant"
    >
      <ShieldCheck />
      Solo administradores
    </Badge>
  );
}

/**
 * Envoltorio para bloques sueltos que solo debe ver un ADMIN (una nota, un aviso). Las
 * listas y secciones ya traen `adminOnly`; esto cubre el markup a medida.
 */
export function AdminOnly({ children }: { children: ReactNode }) {
  const isAdmin = useIsAdmin();
  if (!isAdmin) return null;
  return <>{children}</>;
}

interface SectionProps {
  icon: ReactNode;
  title: string;
  description?: string;
  /** Si es true: oculta la sección entera a un MEMBER y la marca con el badge a un ADMIN. */
  adminOnly?: boolean;
  children: ReactNode;
}

/** Tarjeta de sección con icono, título y descripción. */
export function Section({
  icon,
  title,
  description,
  adminOnly,
  children,
}: SectionProps) {
  const isAdmin = useIsAdmin();

  if (adminOnly && !isAdmin) return null;

  return (
    <section className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5 md:p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
          {icon}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-on-surface">{title}</h2>
            {adminOnly && <AdminOnlyBadge />}
          </div>
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
  /** Si es true: se oculta a un MEMBER y se marca con el badge a un ADMIN (QL-128). */
  adminOnly?: boolean;
}

/**
 * Rejilla de "funciones" (icono + término + descripción). Es el patrón que ya usaba el Muro
 * (`WALL_TOPICS`); lo reutilizan Tareas, Tablero, Muro, Notificaciones y Administración.
 * Filtra los ítems `adminOnly` según el rol.
 */
export function FeatureList({ items }: { items: HelpFeature[] }) {
  const isAdmin = useIsAdmin();
  const visible = items.filter((item) => !item.adminOnly || isAdmin);

  return (
    <ul className="grid gap-3 sm:grid-cols-2 sm:gap-x-8 lg:grid-cols-3">
      {visible.map((item) => (
        <li key={item.term} className="flex gap-3">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-container-high">
            {item.icon}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="font-medium text-on-surface">{item.term}</p>
              {item.adminOnly && <AdminOnlyBadge />}
            </div>
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
  /** Si es true: se oculta a un MEMBER y se marca con el badge a un ADMIN (QL-128). */
  adminOnly?: boolean;
}

/**
 * Rejilla de tarjetas con borde (definición de conceptos). Reutilizada por Conceptos.
 * Filtra los ítems `adminOnly` según el rol.
 */
export function ConceptGrid({ items }: { items: HelpConcept[] }) {
  const isAdmin = useIsAdmin();
  const visible = items.filter((c) => !c.adminOnly || isAdmin);

  return (
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {visible.map((c) => (
        <div
          key={c.term}
          className="rounded-lg border border-outline-variant/40 bg-surface-container-low p-4"
        >
          <dt className="flex flex-wrap items-center gap-2 font-medium text-on-surface">
            {c.icon}
            {c.term}
            {c.adminOnly && <AdminOnlyBadge />}
          </dt>
          <dd className="mt-1 text-sm text-on-surface-variant">{c.desc}</dd>
        </div>
      ))}
    </dl>
  );
}
