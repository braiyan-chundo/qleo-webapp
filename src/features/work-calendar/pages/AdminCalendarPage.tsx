import type { ComponentType } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays, CalendarRange, Clock, PartyPopper } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BackButton } from '@/shared/components/BackButton';
import { ShiftCatalogManager } from '@/features/shifts/components/ShiftCatalogManager';
import { UserScheduleManager } from '@/features/schedules/components/UserScheduleManager';

import { AdminCalendarTab } from '../components/AdminCalendarTab';
import { HolidaysManager } from '../components/HolidaysManager';

/**
 * Descriptor de un tab del Calendario ADMIN. El catálogo es **extensible** (mismo patrón que
 * `AdminSettingsPage`, QL-149): añadir una sección es sumar una entrada con su `Component`.
 */
interface CalendarTab {
  /** Clave estable del tab: valor de la `Tabs` y del query param `?tab=`. */
  value: string;
  label: string;
  icon: LucideIcon;
  Component: ComponentType;
}

const CALENDAR_TABS: readonly CalendarTab[] = [
  {
    value: 'calendario',
    label: 'Calendario',
    icon: CalendarDays,
    Component: AdminCalendarTab,
  },
  {
    value: 'festivos',
    label: 'Festivos',
    icon: PartyPopper,
    Component: HolidaysManager,
  },
  {
    value: 'turnos',
    label: 'Turnos',
    icon: Clock,
    Component: ShiftCatalogManager,
  },
  {
    value: 'mallas',
    label: 'Mallas',
    icon: CalendarRange,
    Component: UserScheduleManager,
  },
] as const;

const DEFAULT_TAB = CALENDAR_TABS[0];

/**
 * Calendario ADMIN (QL-163, solo ADMIN). Cierra el epic "Turnos y mallas" (Lote Y) en el front:
 * reúne el **calendario** (de cualquier usuario), la gestión de **festivos**, el catálogo de
 * **turnos** y las **mallas** horarias por usuario, todo en **una sola ruta** (`/calendar`) con
 * **tabs**. La sección activa vive en el query param `?tab=` (deep-link/refresh estables) en vez
 * de en sub-rutas: se revirtió el esquema `/calendar/festivos|…` de QL-165 para que el sidebar
 * muestre un único ítem "Calendario". Se monta desde la rama ADMIN de `CalendarPage`.
 */
export function AdminCalendarPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get('tab');
  const activeTab =
    CALENDAR_TABS.find((t) => t.value === tabParam) ?? DEFAULT_TAB;

  const selectTab = (value: string) => {
    // El tab por defecto deja la URL limpia (`/calendar`); el resto fija `?tab=`. `replace` evita
    // inflar el historial al alternar secciones.
    if (value === DEFAULT_TAB.value) setSearchParams({}, { replace: true });
    else setSearchParams({ tab: value }, { replace: true });
  };

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

      <Tabs value={activeTab.value}>
        <TabsList variant="line" className="mb-6">
          {CALENDAR_TABS.map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              onClick={() => selectTab(t.value)}
            >
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
