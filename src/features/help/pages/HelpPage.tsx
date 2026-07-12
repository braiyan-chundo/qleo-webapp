import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  AtSign,
  Bell,
  BellOff,
  Fingerprint,
  Info,
  KanbanSquare,
  Keyboard,
  Layers,
  LifeBuoy,
  Lock,
  Mail,
  MessagesSquare,
  Mic,
  Moon,
  Paperclip,
  Pin,
  Reply,
  Rocket,
  Search,
  Send,
  ShieldCheck,
  Users,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

/** Correo de soporte del equipo (contenido estático, sin backend). */
const SUPPORT_EMAIL = 'soporte@viajeshappy.com.co';

/** Pestañas de la Ayuda (QL-106): una sección por pestaña, con su icono para escaneo rápido. */
const HELP_TABS: { value: string; label: string; icon: ReactNode }[] = [
  { value: 'guia', label: 'Guía rápida', icon: <Rocket /> },
  { value: 'muro', label: 'Muro', icon: <MessagesSquare /> },
  { value: 'roles', label: 'Roles', icon: <Users /> },
  { value: 'conceptos', label: 'Conceptos', icon: <Info /> },
  { value: 'atajos', label: 'Atajos', icon: <Keyboard /> },
  { value: 'faq', label: 'FAQ', icon: <LifeBuoy /> },
  { value: 'soporte', label: 'Soporte', icon: <Mail /> },
];

/**
 * Vista de Ayuda (QL-60, `/help`). Contenido 100% estático: guía de uso, muro corporativo,
 * matriz de roles, conceptos clave, atajos, FAQ y soporte. Sin llamadas al backend (no aplica
 * TanStack Query); es una página informativa. Estilos en tokens Material 3 (claro/oscuro).
 *
 * **Layout (QL-106):** se reorganiza en **pestañas de shadcn** (una sección por pestaña) en
 * lugar del *masonry* con CSS `columns` (QL-101). El masonry balanceaba columnas y dejaba
 * huecos que hacían "percibir estrecha" la página; las pestañas dan a cada sección **todo el
 * ancho** y una navegación más clara. La tira de pestañas **scrollea en su propio contenedor**
 * en móvil (`overflow-x-auto`), sin provocar scroll horizontal de la página.
 */
export function HelpPage() {
  return (
    <div className="w-full p-4 md:p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-on-surface">Ayuda</h1>
        <p className="mt-1 text-on-surface-variant">
          Todo lo que necesitas para sacarle partido a Qleo: primeros pasos, el muro
          corporativo, roles, conceptos, atajos y respuestas rápidas.
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

        <TabsContent value="guia" className="mt-4">
          <QuickStartSection />
        </TabsContent>
        <TabsContent value="muro" className="mt-4">
          <WallSection />
        </TabsContent>
        <TabsContent value="roles" className="mt-4">
          <RolesSection />
        </TabsContent>
        <TabsContent value="conceptos" className="mt-4">
          <ConceptsSection />
        </TabsContent>
        <TabsContent value="atajos" className="mt-4">
          <ShortcutsSection />
        </TabsContent>
        <TabsContent value="faq" className="mt-4">
          <FaqSection />
        </TabsContent>
        <TabsContent value="soporte" className="mt-4">
          <SupportSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Bloques compartidos                                                        */
/* -------------------------------------------------------------------------- */

interface SectionProps {
  icon: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
}

/** Tarjeta de sección con icono, título y descripción. */
function Section({ icon, title, description, children }: SectionProps) {
  return (
    <section className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5 md:p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-on-surface">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm text-on-surface-variant">{description}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* 1. Guía rápida                                                             */
/* -------------------------------------------------------------------------- */

const QUICK_STEPS: { title: string; body: ReactNode }[] = [
  {
    title: 'Crea un proyecto',
    body: (
      <>
        Ve a{' '}
        <Link to="/projects" className="font-medium text-primary hover:underline">
          Proyectos
        </Link>{' '}
        y pulsa «Nuevo proyecto». Ponle nombre, código y (opcional) cliente/grupo y color.
      </>
    ),
  },
  {
    title: 'Añade miembros',
    body: 'Abre el proyecto, despliega «Detalles del proyecto» e invita a los miembros que participarán.',
  },
  {
    title: 'Crea etapas y columnas',
    body: 'Organiza el tablero: las etapas agrupan el trabajo y las columnas definen el flujo del Kanban (p. ej. Por hacer → En curso → Hecho).',
  },
  {
    title: 'Crea tareas',
    body: 'Pulsa «Nueva tarea» dentro del proyecto. Asigna un responsable, colaboradores y una fecha límite.',
  },
  {
    title: 'Muévelas en el Kanban',
    body: 'Arrastra las tarjetas entre columnas a medida que avanza el trabajo. También tienes vistas de Lista, Gantt y Planner.',
  },
  {
    title: 'Ciérralas con resumen',
    body: 'Al completar una tarea se pide un resumen obligatorio de lo realizado, para dejar trazabilidad.',
  },
];

function QuickStartSection() {
  return (
    <Section
      icon={<Rocket className="size-5" />}
      title="Guía rápida"
      description="De cero a tu primer tablero en seis pasos."
    >
      <ol className="grid gap-3 sm:grid-cols-2 sm:gap-x-8 lg:grid-cols-3">
        {QUICK_STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary-container text-xs font-semibold text-on-secondary-container tabular-nums">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="font-medium text-on-surface">{step.title}</p>
              <p className="text-sm text-on-surface-variant">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Muro Corporativo                                                        */
/* -------------------------------------------------------------------------- */

const WALL_TOPICS: { icon: ReactNode; term: string; desc: string }[] = [
  {
    icon: <MessagesSquare className="size-4 text-primary" />,
    term: 'Qué es',
    desc: 'Un canal único para todo el equipo: anuncios, novedades y conversación abierta, siempre a la vista de todos.',
  },
  {
    icon: <Send className="size-4 text-primary" />,
    term: 'Publicar',
    desc: 'Escribe en la barra inferior y pulsa enviar (o Enter). Usa Shift + Enter para saltar de línea sin enviar.',
  },
  {
    icon: <AtSign className="size-4 text-primary" />,
    term: 'Menciones',
    desc: 'Escribe «@» y elige a alguien del directorio para avisarle. La persona mencionada aparece resaltada en el mensaje.',
  },
  {
    icon: <Paperclip className="size-4 text-primary" />,
    term: 'Adjuntos',
    desc: 'Pulsa «+» para adjuntar. Según el dispositivo podrás elegir archivo, foto o vídeo, galería o cámara.',
  },
  {
    icon: <Mic className="size-4 text-primary" />,
    term: 'Notas de voz',
    desc: 'Graba y envía un mensaje de audio cuando escribir no sea cómodo. Se reproduce en línea dentro de la conversación.',
  },
  {
    icon: <Reply className="size-4 text-primary" />,
    term: 'Responder',
    desc: 'Cita un mensaje para responderlo en contexto; se muestra a qué mensaje contestas para no perder el hilo.',
  },
  {
    icon: <Pin className="size-4 text-primary" />,
    term: 'Fijados',
    desc: 'Solo un Administrador puede fijar (o desfijar) mensajes destacados para que queden accesibles en la parte superior.',
  },
  {
    icon: <BellOff className="size-4 text-primary" />,
    term: 'No leídos y silenciar',
    desc: 'El indicador del menú muestra cuántos mensajes no has leído. Puedes silenciar el canal si prefieres no recibir avisos.',
  },
];

function WallSection() {
  return (
    <Section
      icon={<MessagesSquare className="size-5" />}
      title="Muro Corporativo"
      description="El canal del equipo: publica, menciona, adjunta y mantente al día."
    >
      <ul className="grid gap-3 sm:grid-cols-2 sm:gap-x-8 lg:grid-cols-3">
        {WALL_TOPICS.map((topic) => (
          <li key={topic.term} className="flex gap-3">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-container-high">
              {topic.icon}
            </span>
            <div className="min-w-0">
              <p className="font-medium text-on-surface">{topic.term}</p>
              <p className="text-sm text-on-surface-variant">{topic.desc}</p>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. Roles por tarea                                                         */
/* -------------------------------------------------------------------------- */

const TASK_ROLES: { label: string; badgeClass: string; desc: string }[] = [
  {
    label: 'Creador',
    badgeClass: 'bg-primary-container text-on-primary-container',
    desc: 'Crea la tarea y define su alcance. Puede bloquear la fecha límite para evitar cambios.',
  },
  {
    label: 'Responsable',
    badgeClass: 'bg-tertiary-container text-on-tertiary-container',
    desc: 'Único encargado de sacar la tarea adelante y cerrarla. Solo puede haber uno por tarea.',
  },
  {
    label: 'Colaborador',
    badgeClass: 'bg-surface-container-high text-on-surface-variant',
    desc: 'Apoya en la ejecución: comenta, adjunta, marca checklist y mueve la tarea en el tablero.',
  },
  {
    label: 'Observador',
    badgeClass:
      'bg-transparent text-on-surface-variant border border-outline-variant/60',
    desc: 'Acceso de solo lectura. Sigue el avance sin poder modificar la tarea.',
  },
];

function RolesSection() {
  return (
    <Section
      icon={<Users className="size-5" />}
      title="Roles por tarea"
      description="Cada tarea define quién hace qué. Es independiente del rol de plataforma."
    >
      <ul className="grid gap-3 lg:grid-cols-2 lg:gap-x-8">
        {TASK_ROLES.map((role) => (
          <li key={role.label} className="flex flex-col gap-1 sm:flex-row sm:gap-3">
            <Badge className={cn('h-fit w-fit shrink-0 sm:mt-0.5', role.badgeClass)}>
              {role.label}
            </Badge>
            <p className="text-sm text-on-surface-variant">{role.desc}</p>
          </li>
        ))}
      </ul>

      <div className="mt-4 rounded-lg border border-outline-variant/40 bg-surface-container-low p-4">
        <p className="flex items-center gap-2 text-sm font-medium text-on-surface">
          <ShieldCheck className="size-4 text-primary" />
          Rol de plataforma vs. rol por tarea
        </p>
        <p className="mt-1 text-sm text-on-surface-variant">
          El <span className="font-medium text-on-surface">rol de plataforma</span> es global:{' '}
          <span className="font-medium text-on-surface">Administrador</span> gestiona
          usuarios y la configuración del espacio;{' '}
          <span className="font-medium text-on-surface">Miembro</span> trabaja en sus
          proyectos. Los cuatro roles de arriba se asignan{' '}
          <span className="font-medium text-on-surface">tarea por tarea</span> y no cambian
          tu rol de plataforma.
        </p>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/* 4. Conceptos clave                                                         */
/* -------------------------------------------------------------------------- */

const CONCEPTS: { term: string; icon: ReactNode; desc: string }[] = [
  {
    term: 'Proyecto · Etapa · Columna',
    icon: <Layers className="size-4 text-primary" />,
    desc: 'El proyecto es el contenedor de trabajo. Dentro, las etapas agrupan tareas por bloques y las columnas representan el flujo del Kanban.',
  },
  {
    term: 'Deadlines y bloqueo del creador',
    icon: <Lock className="size-4 text-primary" />,
    desc: 'Cada tarea puede tener fecha límite. El creador puede bloquearla para que el responsable no la modifique.',
  },
  {
    term: 'Resumen obligatorio al completar',
    icon: <KanbanSquare className="size-4 text-primary" />,
    desc: 'No se puede cerrar una tarea sin un breve resumen de lo realizado. Queda como registro del cierre.',
  },
  {
    term: 'Membresía y visibilidad',
    icon: <Users className="size-4 text-primary" />,
    desc: 'Solo los miembros de un proyecto lo ven y trabajan en él. Añade miembros desde los detalles del proyecto.',
  },
];

function ConceptsSection() {
  return (
    <Section
      icon={<Info className="size-5" />}
      title="Conceptos clave"
      description="Los términos que conviene tener claros."
    >
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {CONCEPTS.map((c) => (
          <div
            key={c.term}
            className="rounded-lg border border-outline-variant/40 bg-surface-container-low p-4"
          >
            <dt className="flex items-center gap-2 font-medium text-on-surface">
              {c.icon}
              {c.term}
            </dt>
            <dd className="mt-1 text-sm text-on-surface-variant">{c.desc}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/* 5. Atajos y trucos                                                         */
/* -------------------------------------------------------------------------- */

function ShortcutsSection() {
  return (
    <Section
      icon={<Keyboard className="size-5" />}
      title="Atajos y trucos"
      description="Pequeñas ayudas para ir más rápido."
    >
      <ul className="grid gap-3 text-sm sm:grid-cols-2 sm:gap-x-8">
        <li className="flex flex-wrap items-center gap-2">
          <Search className="size-4 shrink-0 text-on-surface-variant" />
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
        </li>
        <li className="flex items-center gap-2">
          <Moon className="size-4 shrink-0 text-on-surface-variant" />
          <span className="text-on-surface-variant">
            Cambia entre tema claro y oscuro desde tu perfil o la barra superior.
          </span>
        </li>
        <li className="flex items-center gap-2">
          <Fingerprint className="size-4 shrink-0 text-on-surface-variant" />
          <span className="text-on-surface-variant">
            Activa el acceso biométrico en{' '}
            <Link to="/profile" className="font-medium text-primary hover:underline">
              Mi cuenta
            </Link>{' '}
            para entrar con huella o rostro.
          </span>
        </li>
        <li className="flex items-center gap-2">
          <Bell className="size-4 shrink-0 text-on-surface-variant" />
          <span className="text-on-surface-variant">
            Habilita las notificaciones push para enterarte de asignaciones y vencimientos.
          </span>
        </li>
      </ul>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/* 6. FAQ                                                                     */
/* -------------------------------------------------------------------------- */

const FAQS: { q: string; a: ReactNode }[] = [
  {
    q: '¿Puedo tener varios responsables en una tarea?',
    a: 'No. Cada tarea tiene un único responsable para dejar clara la rendición de cuentas. Sí puedes añadir varios colaboradores.',
  },
  {
    q: '¿Por qué no puedo cambiar la fecha límite de una tarea?',
    a: 'Probablemente el creador la bloqueó. Solo él puede desbloquearla o modificarla.',
  },
  {
    q: '¿Por qué me pide un resumen al completar una tarea?',
    a: 'El resumen es obligatorio: deja constancia de lo realizado y da trazabilidad al cierre.',
  },
  {
    q: '¿Qué diferencia hay entre archivar y eliminar un proyecto?',
    a: 'Archivar lo saca de la vista activa pero conserva su contenido; siempre puedes consultarlo en la pestaña «Archivados».',
  },
  {
    q: '¿Dónde veo todas mis tareas?',
    a: (
      <>
        En{' '}
        <Link to="/tasks" className="font-medium text-primary hover:underline">
          Mis tareas
        </Link>
        , donde puedes ordenarlas por fecha límite o agruparlas por proyecto.
      </>
    ),
  },
];

function FaqSection() {
  return (
    <Section
      icon={<LifeBuoy className="size-5" />}
      title="Preguntas frecuentes"
      description="Las dudas más habituales."
    >
      <Accordion type="single" collapsible className="w-full">
        {FAQS.map((faq, i) => (
          <AccordionItem key={i} value={`faq-${i}`}>
            <AccordionTrigger className="text-on-surface hover:no-underline">
              {faq.q}
            </AccordionTrigger>
            <AccordionContent className="text-on-surface-variant">
              {faq.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/* 7. Soporte / acerca de                                                     */
/* -------------------------------------------------------------------------- */

function SupportSection() {
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
