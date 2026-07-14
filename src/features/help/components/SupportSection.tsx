import { LifeBuoy } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

import { Section } from './HelpPrimitives';

/** Correo de soporte del equipo (contenido estático, sin backend). */
const SUPPORT_EMAIL = 'soporte@viajeshappy.com.co';

export function SupportSection() {
  return (
    <Section
      icon={<LifeBuoy className="size-5" />}
      title="Soporte y acerca de"
      description="¿No encuentras lo que buscas?"
    >
      <div className="space-y-4 text-sm">
        <p className="text-on-surface-variant">
          Escríbenos y te ayudamos lo antes posible:
        </p>
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/40 bg-surface-container-low px-4 py-2 font-medium text-primary transition-colors hover:bg-surface-container-high"
        >
          <LifeBuoy className="size-4" />
          {SUPPORT_EMAIL}
        </a>
        <div className="flex flex-wrap items-center gap-2 pt-2 text-on-surface-variant">
          <span className="font-medium text-on-surface">Qleo</span>
          <Badge className="bg-secondary-container text-on-secondary-container">
            Beta
          </Badge>
          <span>· Gestor colaborativo de proyectos y tareas.</span>
        </div>
      </div>
    </Section>
  );
}
