import type { ReactNode } from 'react';
import {
  Bell,
  HelpCircle,
  Info,
  KanbanSquare,
  Keyboard,
  ListChecks,
  Mail,
  MessagesSquare,
  Rocket,
  Users,
} from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { QuickStartSection } from '../components/QuickStartSection';
import { TasksSection } from '../components/TasksSection';
import { BoardSection } from '../components/BoardSection';
import { WallSection } from '../components/WallSection';
import { RolesSection } from '../components/RolesSection';
import { NotificationsSection } from '../components/NotificationsSection';
import { ConceptsSection } from '../components/ConceptsSection';
import { ShortcutsSection } from '../components/ShortcutsSection';
import { FaqSection } from '../components/FaqSection';
import { SupportSection } from '../components/SupportSection';

/** Pestañas de la Ayuda (QL-126): una sección por pestaña, con su icono para escaneo rápido. */
const HELP_TABS: { value: string; label: string; icon: ReactNode; content: ReactNode }[] = [
  { value: 'guia', label: 'Guía rápida', icon: <Rocket />, content: <QuickStartSection /> },
  { value: 'tareas', label: 'Tareas', icon: <ListChecks />, content: <TasksSection /> },
  { value: 'tablero', label: 'Tablero y vistas', icon: <KanbanSquare />, content: <BoardSection /> },
  { value: 'muro', label: 'Muro', icon: <MessagesSquare />, content: <WallSection /> },
  { value: 'roles', label: 'Roles', icon: <Users />, content: <RolesSection /> },
  { value: 'notificaciones', label: 'Notificaciones', icon: <Bell />, content: <NotificationsSection /> },
  { value: 'conceptos', label: 'Conceptos', icon: <Info />, content: <ConceptsSection /> },
  { value: 'atajos', label: 'Atajos', icon: <Keyboard />, content: <ShortcutsSection /> },
  { value: 'faq', label: 'FAQ', icon: <HelpCircle />, content: <FaqSection /> },
  { value: 'soporte', label: 'Soporte', icon: <Mail />, content: <SupportSection /> },
];

/**
 * Vista de Ayuda (QL-60/QL-126, `/help`). Contenido 100% estático: guía de uso, tareas,
 * tablero y vistas, muro corporativo, roles, notificaciones, conceptos, atajos, FAQ y
 * soporte. Sin llamadas al backend (no aplica TanStack Query); es una página informativa.
 * Estilos en tokens Material 3 (claro/oscuro).
 *
 * **Layout (QL-106):** pestañas de shadcn (una sección por pestaña). Cada sección vive en su
 * propio componente dentro de `features/help/components/` para mantener el archivo legible.
 * La tira de pestañas **scrollea en su propio contenedor** en móvil (`overflow-x-auto`), sin
 * provocar scroll horizontal de la página.
 */
export function HelpPage() {
  return (
    <div className="w-full p-4 md:p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-on-surface">Ayuda</h1>
        <p className="mt-1 text-on-surface-variant">
          Todo lo que necesitas para sacarle partido a Qleo: primeros pasos, tareas,
          tablero, muro, roles, notificaciones, conceptos, atajos y respuestas rápidas.
        </p>
      </header>

      <Tabs defaultValue="guia" className="w-full">
        {/* Tira de pestañas: scroll horizontal contenido en móvil (no desborda la página). */}
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <TabsList variant="line" className="w-max">
            {HELP_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="shrink-0">
                {tab.icon}
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {HELP_TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-4">
            {tab.content}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
