import { useState } from 'react';
import { LifeBuoy, Pencil } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAppSettings } from '@/features/settings/hooks/use-settings';
import { DEFAULT_SUPPORT_EMAIL } from '@/features/settings/services/settings.service';

import { SupportEmailForm } from '@/features/settings/components/SupportEmailForm';

import { useIsAdmin } from '../hooks/use-is-admin';
import { AdminOnlyBadge, Section } from './HelpPrimitives';

/**
 * Soporte y acerca de. El correo ya **no está hardcodeado** (QL-129): sale de los ajustes
 * globales (`useAppSettings`). Mientras la query carga o si falla se cae al
 * `DEFAULT_SUPPORT_EMAIL`, de modo que la sección nunca queda sin dirección de contacto.
 *
 * Un ADMIN puede editarlo aquí mismo (inline): es el único sitio donde el valor se consume,
 * así que edita justo lo que ve, sin pasar por `/admin`.
 */
export function SupportSection() {
  const { data } = useAppSettings();
  const isAdmin = useIsAdmin();
  const [isEditing, setIsEditing] = useState(false);

  const supportEmail = data?.supportEmail ?? DEFAULT_SUPPORT_EMAIL;

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

        {isEditing ? (
          <SupportEmailForm
            currentEmail={supportEmail}
            onDone={() => setIsEditing(false)}
          />
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`mailto:${supportEmail}`}
              className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/40 bg-surface-container-low px-4 py-2 font-medium text-primary transition-colors hover:bg-surface-container-high"
            >
              <LifeBuoy className="size-4" />
              {supportEmail}
            </a>
            {isAdmin && (
              <>
                <Button variant="ghost" onClick={() => setIsEditing(true)}>
                  <Pencil className="size-4" />
                  Editar
                </Button>
                <AdminOnlyBadge />
              </>
            )}
          </div>
        )}

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
