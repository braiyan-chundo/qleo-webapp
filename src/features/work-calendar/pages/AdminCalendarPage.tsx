import type { ComponentType } from 'react';
import { CalendarDays, CalendarRange, Clock, PartyPopper } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BackButton } from '@/shared/components/BackButton';
import { useQueryParamState } from '@/shared/hooks/use-query-param-state';
import { ShiftCatalogManager } from '@/features/shifts/components/ShiftCatalogManager';
import { UserScheduleManager } from '@/features/schedules/components/UserScheduleManager';

import { AdminCalendarTab } from '../components/AdminCalendarTab';
import { HolidaysManager } from '../components/HolidaysManager';

/**
 * Descriptor de un tab del Calendario ADMIN. El catálogo es **extensible** (mismo patrón que
 * `AdminSettingsPage`, QL-149): añadir una sección es sumar una entrada con su `Component`.
 */
interface CalendarTab {
  /** Clave estable persistida en el query param `?tab=`. */
  value: string;
  label: string;
  icon: LucideIcon;
  Component: ComponentType;
}

const CALENDAR_TABS: readonly CalendarTab[] = [
  { value: 'calendario', label: 'Calendario', icon: CalendarDays, Component: AdminCalendarTab },
  { value: 'festivos', label: 'Festivos', icon: PartyPopper, Component: HolidaysManager },
  { value: 'turnos', label: 'Turnos', icon: Clock, Component: ShiftCatalogManager },
  { value: 'mallas', label: 'Mallas', icon: CalendarRange, Component: UserScheduleManager },
] as const;

const DEFAULT_TAB = CALENDAR_TABS[0].value;

/**
 * Calendario ADMIN (QL-163, solo ADMIN). Cierra el epic "Turnos y mallas" (Lote Y) en el front:
 * reúne en tabs el **calendario** (de cualquier usuario), la gestión de **festivos**, el catálogo
 * de **turnos** y las **mallas** horarias por usuario. La sección activa vive en `?tab=` para
 * poder compartir el enlace. Se monta desde la rama ADMIN de `CalendarPage`.
 */
export function AdminCalendarPage() {
  const [tab, setTab] = useQueryParamState<string>('tab', DEFAULT_TAB);

  const activeTab = CALENDAR_TABS.some((t) => t.value === tab) ? tab : DEFAULT_TAB;

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 flex items-start gap-3">
        <BackButton fallback={{ to: '/', label: 'Inicio' }} />
        <div>
          <h1 className="text-3xl font-bold text-on-surface">Calendario laboral</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Calendario por usuario, festivos, catálogo de turnos y mallas horarias.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setTab}>
        <TabsList variant="line" className="mb-6">
          {CALENDAR_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              <t.icon />
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {CALENDAR_TABS.map(({ value, Component }) => (
          <TabsContent key={value} value={value}>
            <Component />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
