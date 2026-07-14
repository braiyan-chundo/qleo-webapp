import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Rocket } from 'lucide-react';

import { Section } from './HelpPrimitives';

/** Pasos de arranque (QL-126). Cada uno enlaza a la ruta real cuando aplica. */
const QUICK_STEPS: { title: string; body: ReactNode }[] = [
  {
    title: 'Crea un proyecto',
    body: (
      <>
        Ve a{' '}
        <Link to="/projects" className="font-medium text-primary hover:underline">
          Proyectos
        </Link>{' '}
        y pulsa «Nuevo proyecto». Ponle nombre (obligatorio) y, si quieres, código,
        cliente/grupo y un color para reconocerlo.
      </>
    ),
  },
  {
    title: 'Añade miembros',
    body: 'Abre el proyecto, entra en «Detalles del proyecto» e invita a quienes participarán. Solo los miembros ven el proyecto y pueden recibir roles en sus tareas.',
  },
  {
    title: 'Configura el tablero',
    body: 'Desde «Configurar tablero» crea las etapas (agrupan el trabajo) y las columnas del Kanban (p. ej. Por hacer → En curso → Hecho). La columna Backlog es la de por defecto.',
  },
  {
    title: 'Crea tareas',
    body: 'Pulsa «Nueva tarea» o el «+» de una columna. Asigna un Responsable (único), Colaboradores y, si aplica, una fecha límite.',
  },
  {
    title: 'Trabaja en el tablero',
    body: 'Arrastra las tarjetas entre columnas en el Kanban. También tienes vistas de Lista, Gantt, Planner y Documentos.',
  },
  {
    title: 'Ciérralas con resumen',
    body: 'Al completar una tarea se pide un resumen de lo realizado (obligatorio salvo que adjuntes un archivo probatorio). Queda como registro del cierre.',
  },
];

export function QuickStartSection() {
  return (
    <Section
      icon={<Rocket className="size-5" />}
      title="Guía rápida"
      description="De cero a tu primer tablero en seis pasos."
    >
      <ol className="grid gap-3 sm:grid-cols-2 sm:gap-x-8 lg:grid-cols-3">
        {QUICK_STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary-container text-xs font-semibold text-on-secondary-container tabular-nums">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="font-medium text-on-surface">{step.title}</p>
              <p className="text-sm text-on-surface-variant">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-5 rounded-lg border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
        ¿Quieres más detalle? Revisa las pestañas{' '}
        <span className="font-medium text-on-surface">Tareas</span>,{' '}
        <span className="font-medium text-on-surface">Tablero y vistas</span> y{' '}
        <span className="font-medium text-on-surface">Notificaciones</span>.
      </p>
    </Section>
  );
}
