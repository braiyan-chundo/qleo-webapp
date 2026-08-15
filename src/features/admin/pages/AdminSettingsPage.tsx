import type { ComponentType } from 'react';
import { BellRing, ShieldCheck, Sparkles, Tags, UsersRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BackButton } from '@/shared/components/BackButton';
import { useQueryParamState } from '@/shared/hooks/use-query-param-state';
import { hasAtLeastRole } from '@/shared/lib/permissions';
import { useAuthStore } from '@/store/auth.store';
import { LabelCatalogManager } from '@/features/labels/components/LabelCatalogManager';
import { AvatarCatalogManager } from '@/features/avatars/components/AvatarCatalogManager';
import { AiConnectionManager } from '@/features/ai/components/AiConnectionManager';
import { PermissionProfilesManager } from '@/features/permission-profiles/components/PermissionProfilesManager';
import { ManagementAlertsForm } from '@/features/settings/components/ManagementAlertsForm';

/**
 * Descriptor de un tab de Configuración. El catálogo de tabs es **extensible** (QL-149): añadir
 * una sección futura (p. ej. "Soporte" con el `supportEmail` de QL-129, o info de versión) es
 * sumar una entrada a `SETTINGS_TABS` con su `Component`; no hay que tocar la página.
 */
interface SettingsTab {
  /** Clave estable persistida en el query param `?tab=`. */
  value: string;
  label: string;
  icon: LucideIcon;
  Component: ComponentType;
  /**
   * (QL-198b) `true` = la sección es de **Dirección**. Los tabs sin la marca los ve también quien
   * llegó por un permiso delegado (`LABEL_MANAGE` abre la ruta), que es exactamente lo que evita
   * que ese permiso se conceda y no sirva de nada.
   */
  adminOnly?: boolean;
}

const SETTINGS_TABS: readonly SettingsTab[] = [
  // Curar el catálogo es delegable con `LABEL_MANAGE`: sin `adminOnly`.
  { value: 'etiquetas', label: 'Etiquetas', icon: Tags, Component: LabelCatalogManager },
  // (QL-198, §3.70) Perfiles de permisos: agrupan permisos del catálogo y se asignan por usuario.
  {
    value: 'perfiles',
    label: 'Perfiles de permisos',
    icon: ShieldCheck,
    Component: PermissionProfilesManager,
    // Componer perfiles es administrar permisos: nunca delegable (§3.70 §1).
    adminOnly: true,
  },
  // (QL-181, §3.59) Catálogo global de avatares seleccionables.
  {
    value: 'avatares',
    label: 'Avatares',
    icon: UsersRound,
    Component: AvatarCatalogManager,
    adminOnly: true,
  },
  // (QL-200, §3.72 §4) Umbrales de las alertas de gestión + su interruptor general. Materia de
  // Dirección por definición (habla del desempeño de terceros): nunca delegable.
  {
    value: 'alertas',
    label: 'Alertas de gestión',
    icon: BellRing,
    Component: ManagementAlertsForm,
    adminOnly: true,
  },
  // (QL-185, §3.62) Conexión IA de la plataforma (device login con ChatGPT).
  {
    value: 'conexion-ia',
    label: 'Conexión IA',
    icon: Sparkles,
    Component: AiConnectionManager,
    adminOnly: true,
  },
] as const;

/**
 * Vista global de **Configuración** (QL-149). Agrupa ajustes del espacio en tabs. La sección
 * activa se refleja en el query param `?tab=` para poder compartir el enlace.
 *
 * (QL-198b) La ruta la abre Dirección **o** quien tenga `LABEL_MANAGE` delegado; los tabs se
 * filtran por rol, así que un delegado entra y ve solo "Etiquetas". El backend sigue siendo la
 * autoridad de cada acción: esto evita ofrecer pantallas que responderían 403.
 */
export function AdminSettingsPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = hasAtLeastRole(user, 'MANAGER');

  const tabs = SETTINGS_TABS.filter((t) => !t.adminOnly || isAdmin);
  const defaultTab = tabs[0]?.value ?? SETTINGS_TABS[0].value;

  const [tab, setTab] = useQueryParamState<string>('tab', defaultTab);

  const activeTab = tabs.some((t) => t.value === tab) ? tab : defaultTab;

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 flex items-start gap-3">
        <BackButton fallback={{ to: '/', label: 'Inicio' }} />
        <div>
          <h1 className="text-3xl font-bold text-on-surface">Configuración</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Ajustes globales del espacio de trabajo.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setTab}>
        <TabsList variant="line" className="mb-4">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              <t.icon />
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map(({ value, Component }) => (
          <TabsContent key={value} value={value}>
            <Component />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
