import type { ComponentType } from 'react';
import { Tags, UsersRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BackButton } from '@/shared/components/BackButton';
import { useQueryParamState } from '@/shared/hooks/use-query-param-state';
import { LabelCatalogManager } from '@/features/labels/components/LabelCatalogManager';
import { AvatarCatalogManager } from '@/features/avatars/components/AvatarCatalogManager';

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
}

const SETTINGS_TABS: readonly SettingsTab[] = [
  { value: 'etiquetas', label: 'Etiquetas', icon: Tags, Component: LabelCatalogManager },
  // (QL-181, §3.59) Catálogo global de avatares seleccionables.
  { value: 'avatares', label: 'Avatares', icon: UsersRound, Component: AvatarCatalogManager },
] as const;

const DEFAULT_TAB = SETTINGS_TABS[0].value;

/**
 * Vista global de **Configuración** de administración (QL-149, solo ADMIN). Agrupa ajustes del
 * espacio en tabs; hoy solo el catálogo global de **Etiquetas**. La sección activa se refleja en
 * el query param `?tab=` para poder compartir el enlace.
 */
export function AdminSettingsPage() {
  const [tab, setTab] = useQueryParamState<string>('tab', DEFAULT_TAB);

  const activeTab = SETTINGS_TABS.some((t) => t.value === tab) ? tab : DEFAULT_TAB;

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
          {SETTINGS_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              <t.icon />
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {SETTINGS_TABS.map(({ value, Component }) => (
          <TabsContent key={value} value={value}>
            <Component />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
