import { useMemo } from 'react';
import { Check, Info, Minus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { USER_ROLE_LABEL, roleIsAtLeast } from '@/shared/lib/permissions';
import type { UserRole } from '@/store/auth.store';

import { usePermissionCatalog } from '../hooks/use-permission-profiles';
import type { PermissionCatalogItem } from '../services/permission-profiles.service';

/** De dónde puede venir un permiso ya concedido. */
type PermissionSource = 'role' | 'profile' | 'individual';

const SOURCE_LABEL: Record<PermissionSource, string> = {
  role: 'Por su rol',
  profile: 'Por el perfil',
  individual: 'Individual',
};

/** Lo que el panel necesita saber del usuario. Sirve tanto para `User` como para `UserSummary`. */
export interface EffectivePermissionsSubject {
  role: UserRole;
  canCreateProjects?: boolean;
  canUseAi?: boolean;
  profile?: {
    id: string;
    name: string;
    permissions: string[];
    active: boolean;
  } | null;
  /** Lo que **decide**: la unión ya calculada por el backend. */
  effectivePermissions?: string[];
}

/**
 * ¿De dónde le viene este permiso? **Atribución, no autorización.**
 *
 * La diferencia importa y es la línea que no se cruza: quién TIENE el permiso lo dice
 * `effectivePermissions` (lo calcula el backend con la misma función que sus guards, §3.70 §0), y
 * esta función no participa en esa decisión — solo explica un permiso que el servidor ya concedió.
 * Reimplementar la fórmula para decidir es el fallo de QL-192; explicarla con los datos que el
 * propio servidor manda (rol, `profile`, flags) es justo lo que evita el otro fallo: apagar el
 * perfil creyendo que se cortó un acceso que en realidad venía del interruptor individual.
 *
 * El mapeo permiso→interruptor sale de `legacyFlag`, que el catálogo trae para esto. Los permisos
 * de QL-198b lo tienen a `null`: no existen como interruptor suelto, así que solo pueden venir del
 * rol o del perfil.
 */
function sourcesOf(
  subject: EffectivePermissionsSubject,
  item: PermissionCatalogItem,
): PermissionSource[] {
  const sources: PermissionSource[] = [];

  // ADMIN y Dirección superan el catálogo entero: el rol no pasa por perfiles ni por flags.
  if (roleIsAtLeast(subject.role, 'MANAGER')) sources.push('role');

  // Un perfil RETIRADO no aporta nada, aunque siga asignado (§3.70 §4).
  if (subject.profile?.active && subject.profile.permissions.includes(item.key)) {
    sources.push('profile');
  }

  if (item.legacyFlag === 'canCreateProjects' && subject.canCreateProjects) {
    sources.push('individual');
  }
  // Default invertido: ausente = concedido. `?? false` dejaría sin IA a media plantilla.
  if (item.legacyFlag === 'canUseAi' && (subject.canUseAi ?? true)) {
    sources.push('individual');
  }

  return sources;
}

interface EffectivePermissionsPanelProps {
  subject: EffectivePermissionsSubject;
  /** Aviso de que lo mostrado es el estado **guardado**, no el del formulario sin guardar. */
  pendingChanges?: boolean;
  className?: string;
}

/**
 * QL-198 (§3.70) — Qué puede hacer esta persona, **y por qué**.
 *
 * Existe para desactivar la trampa central de la HU: el perfil y los interruptores individuales
 * **suman**, así que quitarle el perfil a alguien **no** revoca lo que tenga concedido a mano. Sin
 * ver las dos cosas juntas, un administrador apaga el perfil convencido de que cortó el acceso y
 * no corta nada. Por eso cada permiso concedido lleva **todas** sus procedencias, y los que vienen
 * por más de una vía se señalan explícitamente.
 *
 * La lista de "lo concedido" sale **siempre** de `effectivePermissions` (backend); las
 * procedencias son texto explicativo derivado de datos que el mismo backend manda. Si alguna vez
 * divergieran, manda `effectivePermissions`: es lo que aplican los guards.
 */
export function EffectivePermissionsPanel({
  subject,
  pendingChanges = false,
  className,
}: EffectivePermissionsPanelProps) {
  const { data: catalog, isLoading } = usePermissionCatalog();

  const granted = useMemo(
    () => new Set(subject.effectivePermissions ?? []),
    [subject.effectivePermissions],
  );

  const rows = useMemo(
    () =>
      (catalog ?? []).map((item) => ({
        item,
        granted: granted.has(item.key),
        sources: sourcesOf(subject, item),
      })),
    [catalog, granted, subject],
  );

  /**
   * Permisos que el perfil concede **y** el usuario ya tenía por otra vía. Son exactamente los
   * que sobrevivirían a quitarle el perfil: decirlo aquí evita la falsa sensación de haber
   * revocado.
   */
  const survivesProfileRemoval = rows.filter(
    (row) => row.granted && row.sources.includes('profile') && row.sources.length > 1,
  );

  if (isLoading) {
    return <Skeleton className={cn('h-40 rounded-lg', className)} />;
  }

  // Sin catálogo (fallo de red) no se inventa nada: mejor no pintar el panel que pintarlo a medias.
  if (rows.length === 0) return null;

  return (
    <div
      className={cn(
        'grid gap-2 rounded-lg border border-outline-variant/50 bg-surface-container-low px-4 py-3',
        className,
      )}
    >
      <div className="grid gap-0.5">
        <span className="text-sm font-medium text-on-surface">
          Lo que esta persona puede hacer
        </span>
        <span className="text-xs text-on-surface-variant">
          {pendingChanges
            ? 'Refleja lo guardado: los cambios de arriba se aplican al guardar.'
            : 'Lo calcula el servidor sumando su rol, su perfil y sus permisos individuales.'}
        </span>
      </div>

      <ul className="grid gap-1.5">
        {rows.map(({ item, granted: isGranted, sources }) => (
          <li key={item.key} className="flex items-start gap-2">
            {isGranted ? (
              <Check className="mt-0.5 size-4 shrink-0 text-tertiary" aria-hidden />
            ) : (
              <Minus className="mt-0.5 size-4 shrink-0 text-outline" aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    'text-sm',
                    isGranted ? 'text-on-surface' : 'text-on-surface-variant line-through',
                  )}
                >
                  {item.label}
                </span>
                {isGranted &&
                  sources.map((source) => (
                    <Badge
                      key={source}
                      variant="outline"
                      className="border-outline-variant/60 px-1.5 py-0 text-[10px] font-normal text-on-surface-variant"
                    >
                      {source === 'role'
                        ? `${SOURCE_LABEL.role} (${USER_ROLE_LABEL[subject.role]})`
                        : SOURCE_LABEL[source]}
                    </Badge>
                  ))}
              </div>
              {/*
                (§3.70 §1) La `description` del catálogo, íntegra. En `TASK_DISCARD` es donde vive
                el ALCANCE POR PROYECTO ("únicamente en los proyectos donde el usuario es
                miembro"): sin ella el permiso se leería como global, que es justo lo que no es.
              */}
              <p className="text-xs leading-snug text-on-surface-variant">{item.description}</p>
            </div>
          </li>
        ))}
      </ul>

      {survivesProfileRemoval.length > 0 && (
        <p className="inline-flex items-start gap-1.5 rounded-md border border-outline-variant/60 bg-surface-container px-2.5 py-2 text-xs text-on-surface-variant">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            <strong className="text-on-surface">Quitarle el perfil no le quitaría</strong>{' '}
            {survivesProfileRemoval.map((row) => row.item.label).join(', ')}: también lo tiene por
            su rol o concedido individualmente. Para cortarlo de verdad hay que retirar también esa
            otra vía.
          </span>
        </p>
      )}
    </div>
  );
}
