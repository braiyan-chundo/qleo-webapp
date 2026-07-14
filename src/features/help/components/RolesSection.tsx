import { Check, Minus, ShieldCheck, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { Section } from './HelpPrimitives';

const TASK_ROLES: { label: string; badgeClass: string; desc: string }[] = [
  {
    label: 'Creador',
    badgeClass: 'bg-primary-container text-on-primary-container',
    desc: 'Crea la tarea y define su alcance. Gestiona los roles, edita/elimina la tarea y puede bloquear la fecha límite.',
  },
  {
    label: 'Responsable',
    badgeClass: 'bg-tertiary-container text-on-tertiary-container',
    desc: 'Único encargado de sacar la tarea adelante y cerrarla. Solo puede haber uno por tarea.',
  },
  {
    label: 'Colaborador',
    badgeClass: 'bg-surface-container-high text-on-surface-variant',
    desc: 'Apoya en la ejecución: comenta, adjunta, marca checklist, cronometra y mueve la tarea en el tablero.',
  },
  {
    label: 'Observador',
    badgeClass:
      'bg-transparent text-on-surface-variant border border-outline-variant/60',
    desc: 'Acceso de solo lectura. Sigue el avance sin poder modificar la tarea.',
  },
];

/** Celda de la matriz: `true` puede, `false` no puede, string = matiz corto. */
type Cell = boolean | string;

const MATRIX_COLS = ['Creador', 'Responsable', 'Colaborador', 'Observador'] as const;

/** Qué puede hacer cada rol (derivado del gating real de la ficha de tarea). */
const MATRIX_ROWS: { action: string; cells: [Cell, Cell, Cell, Cell] }[] = [
  { action: 'Ver la tarea', cells: [true, true, true, true] },
  { action: 'Comentar · checklist · adjuntar', cells: [true, true, true, false] },
  { action: 'Cronómetro · mover en el tablero', cells: [true, true, true, false] },
  { action: 'Completar y reabrir', cells: [true, true, false, false] },
  { action: 'Editar la fecha límite', cells: [true, 'Si no está bloqueada', 'Si no está bloqueada', false] },
  { action: 'Bloquear la fecha límite', cells: [true, false, false, false] },
  { action: 'Solicitar prórroga', cells: ['—', 'Si está bloqueada', 'Si está bloqueada', false] },
  { action: 'Gestionar roles · editar · eliminar', cells: [true, false, false, false] },
];

function MatrixCell({ value }: { value: Cell }) {
  if (value === true) {
    return (
      <span className="inline-flex items-center justify-center">
        <Check className="size-4 text-primary" aria-label="Sí" />
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="inline-flex items-center justify-center">
        <Minus className="size-4 text-on-surface-variant/50" aria-label="No" />
      </span>
    );
  }
  return <span className="text-xs text-on-surface-variant">{value}</span>;
}

export function RolesSection() {
  return (
    <div className="space-y-6">
      <Section
        icon={<Users className="size-5" />}
        title="Roles por tarea"
        description="Cada tarea define quién hace qué. Es independiente del rol de plataforma."
      >
        <ul className="grid gap-3 lg:grid-cols-2 lg:gap-x-8">
          {TASK_ROLES.map((role) => (
            <li key={role.label} className="flex flex-col gap-1 sm:flex-row sm:gap-3">
              <Badge className={cn('h-fit w-fit shrink-0 sm:mt-0.5', role.badgeClass)}>
                {role.label}
              </Badge>
              <p className="text-sm text-on-surface-variant">{role.desc}</p>
            </li>
          ))}
        </ul>

        <div className="mt-4 rounded-lg border border-outline-variant/40 bg-surface-container-low p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-on-surface">
            <ShieldCheck className="size-4 text-primary" />
            Rol de plataforma vs. rol por tarea
          </p>
          <p className="mt-1 text-sm text-on-surface-variant">
            El <span className="font-medium text-on-surface">rol de plataforma</span> es
            global: <span className="font-medium text-on-surface">Administrador</span>{' '}
            gestiona usuarios y la configuración del espacio (y ve la auditoría);{' '}
            <span className="font-medium text-on-surface">Miembro</span> trabaja en sus
            proyectos. Los cuatro roles de arriba se asignan{' '}
            <span className="font-medium text-on-surface">tarea por tarea</span> y no
            cambian tu rol de plataforma.
          </p>
        </div>
      </Section>

      <Section
        icon={<ShieldCheck className="size-5" />}
        title="Qué puede hacer cada rol"
        description="Resumen de permisos dentro de una tarea."
      >
        {/* La tabla es ancha: scrollea dentro de su propio contenedor para no desbordar la
            página en móvil. */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-outline-variant/60">
                <th className="py-2 pr-3 text-left font-medium text-on-surface-variant">
                  Acción
                </th>
                {MATRIX_COLS.map((col) => (
                  <th
                    key={col}
                    className="px-2 py-2 text-center font-medium text-on-surface-variant"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATRIX_ROWS.map((row) => (
                <tr
                  key={row.action}
                  className="border-b border-outline-variant/30 last:border-0"
                >
                  <th
                    scope="row"
                    className="py-2 pr-3 text-left font-normal text-on-surface"
                  >
                    {row.action}
                  </th>
                  {row.cells.map((cell, i) => (
                    <td key={i} className="px-2 py-2 text-center">
                      <MatrixCell value={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-on-surface-variant">
          El Responsable y los Colaboradores editan la fecha límite mientras el Creador no
          la bloquee; si la bloquea, pueden solicitarle una prórroga.
        </p>
      </Section>
    </div>
  );
}
