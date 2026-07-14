import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  CornerDownLeft,
  Fingerprint,
  Keyboard,
  MousePointerClick,
  Moon,
  Search,
} from 'lucide-react';

import { Kbd, KbdGroup } from '@/components/ui/kbd';

import { Section } from './HelpPrimitives';

/** Un truco = icono + contenido (puede incluir teclas y enlaces). */
const SHORTCUTS: { icon: ReactNode; content: ReactNode }[] = [
  {
    icon: <Search className="size-4 shrink-0 text-on-surface-variant" />,
    content: (
      <span className="flex flex-wrap items-center gap-2">
        <span className="text-on-surface-variant">Buscador global:</span>
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
        <span className="text-on-surface-variant">(o</span>
        <KbdGroup>
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
        <span className="text-on-surface-variant">) para saltar a proyectos y tareas.</span>
      </span>
    ),
  },
  {
    icon: <CornerDownLeft className="size-4 shrink-0 text-on-surface-variant" />,
    content: (
      <span className="flex flex-wrap items-center gap-2 text-on-surface-variant">
        <span>En el muro,</span>
        <Kbd>Enter</Kbd>
        <span>envía y</span>
        <KbdGroup>
          <Kbd>Shift</Kbd>
          <Kbd>Enter</Kbd>
        </KbdGroup>
        <span>salta de línea.</span>
      </span>
    ),
  },
  {
    icon: <MousePointerClick className="size-4 shrink-0 text-on-surface-variant" />,
    content: (
      <span className="text-on-surface-variant">
        En el Kanban, arrastra las tarjetas para moverlas; un clic (sin arrastrar) abre la
        vista completa de la tarea.
      </span>
    ),
  },
  {
    icon: <Moon className="size-4 shrink-0 text-on-surface-variant" />,
    content: (
      <span className="text-on-surface-variant">
        Cambia entre tema claro y oscuro desde la barra superior o desde{' '}
        <Link to="/profile" className="font-medium text-primary hover:underline">
          Mi cuenta
        </Link>
        .
      </span>
    ),
  },
  {
    icon: <Fingerprint className="size-4 shrink-0 text-on-surface-variant" />,
    content: (
      <span className="text-on-surface-variant">
        Activa el acceso biométrico en{' '}
        <Link to="/profile" className="font-medium text-primary hover:underline">
          Mi cuenta
        </Link>{' '}
        para entrar con huella o rostro.
      </span>
    ),
  },
  {
    icon: <Bell className="size-4 shrink-0 text-on-surface-variant" />,
    content: (
      <span className="text-on-surface-variant">
        Habilita las notificaciones push para enterarte de menciones y prórrogas aunque la
        app esté cerrada.
      </span>
    ),
  },
];

export function ShortcutsSection() {
  return (
    <Section
      icon={<Keyboard className="size-5" />}
      title="Atajos y trucos"
      description="Pequeñas ayudas para ir más rápido."
    >
      <ul className="grid gap-3 text-sm sm:grid-cols-2 sm:gap-x-8">
        {SHORTCUTS.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-0.5">{item.icon}</span>
            {item.content}
          </li>
        ))}
      </ul>
    </Section>
  );
}
