import type { ComponentType } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CalendarDays, CalendarRange, Clock, PartyPopper } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BackButton } from '@/shared/components/BackButton';
import { activeNavUrl } from '@/shared/config/nav';
import { ShiftCatalogManager } from '@/features/shifts/components/ShiftCatalogManager';
import { UserScheduleManager } from '@/features/schedules/components/UserScheduleManager';

import { AdminCalendarTab } from '../components/AdminCalendarTab';
import { HolidaysManager } from '../components/HolidaysManager';

/**
 * Descriptor de un tab del Calendario ADMIN. El catálogo es **extensible** (mismo patrón que
 * `AdminSettingsPage`, QL-149): añadir una sección es sumar una entrada con su `Component`.
 */
interface CalendarTab {
  /** Clave estable del tab (valor de la `Tabs`). */
  value: string;
  /**
   * Sub-ruta de la sección (QL-165). La sección activa se deriva del `pathname` (no de `?tab=`),
   * para que el sidebar se ilumine por ruta. Los tabs navegan a esta `url`.
   */
  url: string;
  label: string;
  icon: LucideIcon;
  Component: ComponentType;
}

const CALENDAR_TABS: readonly CalendarTab[] = [
  {
    value: 'calendario',
    url: '/calendar',
    label: 'Calendario',
    icon: CalendarDays,
    Component: AdminCalendarTab,
  },
  {
    value: 'festivos',
    url: '/calendar/festivos',
    label: 'Festivos',
    icon: PartyPopper,
    Component: HolidaysManager,
  },
  {
    value: 'turnos',
    url: '/calendar/turnos',
    label: 'Turnos',
    icon: Clock,
    Component: ShiftCatalogManager,
  },
  {
    value: 'mallas',
    url: '/calendar/mallas',
    label: 'Mallas',
    icon: CalendarRange,
    Component: UserScheduleManager,
  },
] as const;

/**
 * Calendario ADMIN (QL-163/QL-165, solo ADMIN). Cierra el epic "Turnos y mallas" (Lote Y) en el
 * front: reúne el **calendario** (de cualquier usuario), la gestión de **festivos**, el catálogo de
 * **turnos** y las **mallas** horarias por usuario. Desde QL-165 cada sección es una **sub-ruta**
 * (`/calendar`, `/calendar/festivos`, …) en vez de un `?tab=`, para que el resaltado del sidebar
 * case por `pathname`; la sección activa se deriva del pathname (el prefijo más largo que casa, vía
 * `activeNavUrl`) y los tabs navegan a su ruta. Se monta desde la rama ADMIN de `CalendarPage`.
 */
export function AdminCalendarPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const activeUrl = activeNavUrl(pathname, CALENDAR_TABS) ?? CALENDAR_TABS[0].url;
  const activeTab =
    CALENDAR_TABS.find((t) => t.url === activeUrl) ?? CALENDAR_TABS[0];

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
              onClick={() => navigate(t.url)}
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
