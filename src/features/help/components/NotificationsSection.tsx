import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  BatteryCharging,
  Bell,
  BellRing,
  Download,
  Smartphone,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

import { Section, FeatureList, type HelpFeature } from './HelpPrimitives';

/** Canales y ajustes de notificación (verificados en `features/notifications` y `features/push`). */
const NOTIFICATION_FEATURES: HelpFeature[] = [
  {
    icon: <Bell className="size-4 text-primary" />,
    term: 'Campana (dentro de la app)',
    desc: (
      <>
        El icono de campana marca los avisos sin leer. En{' '}
        <Link to="/notifications" className="font-medium text-primary hover:underline">
          Notificaciones
        </Link>{' '}
        ves la bandeja, filtras por no leídas y marcas todo como leído. Avisa cuando te
        mencionan en una tarea o cuando alguien pide una prórroga de fecha límite.
      </>
    ),
  },
  {
    icon: <BellRing className="size-4 text-primary" />,
    term: 'Push (aunque la app esté cerrada)',
    desc: (
      <>
        Las notificaciones push llegan aunque no tengas Qleo abierto. Actívalas desde el
        banner superior o desde{' '}
        <Link to="/profile" className="font-medium text-primary hover:underline">
          Mi cuenta
        </Link>
        , y concede el permiso que pide el navegador.
      </>
    ),
  },
  {
    icon: <Smartphone className="size-4 text-primary" />,
    term: 'Badge del icono',
    desc: 'Si instalas Qleo como app, el icono muestra un número con tus avisos pendientes. Se pone a cero al abrir la app.',
  },
  {
    icon: <Download className="size-4 text-primary" />,
    term: 'Instalar como app (PWA)',
    desc: 'Instala Qleo desde el menú de tu navegador («Instalar app» o «Añadir a pantalla de inicio»). Mejora la recepción de push y habilita el badge del icono.',
  },
  {
    icon: <Bell className="size-4 text-primary" />,
    term: 'Silenciar el muro',
    desc: (
      <>
        En{' '}
        <Link to="/profile" className="font-medium text-primary hover:underline">
          Mi cuenta
        </Link>{' '}
        puedes silenciar el muro corporativo: dejas de recibir el aviso de cada mensaje,
        pero las @menciones siguen llegando.
      </>
    ),
  },
];

/** Pasos de la solución de problemas de push (redactados para el usuario, sin jerga técnica). */
const PUSH_TROUBLESHOOTING: { title: string; body: ReactNode }[] = [
  {
    title: 'Activa las notificaciones',
    body: 'Comprueba en Mi cuenta que las notificaciones push están activadas y que concediste el permiso al navegador. Si las bloqueaste, actívalas desde los ajustes del sitio en el navegador.',
  },
  {
    title: 'Instala Qleo como app',
    body: 'En el móvil, instala Qleo desde el menú del navegador («Instalar app» / «Añadir a pantalla de inicio»). La app instalada recibe los push de forma mucho más fiable que una pestaña suelta.',
  },
  {
    title: 'Quítala de la optimización de batería',
    body: 'Algunos teléfonos Android cierran las apps en segundo plano para ahorrar batería y eso corta los avisos. En los ajustes del teléfono, busca la optimización o el ahorro de batería y marca Qleo como «Sin restricciones» / «No optimizar».',
  },
];

export function NotificationsSection() {
  return (
    <div className="space-y-6">
      <Section
        icon={<Bell className="size-5" />}
        title="Notificaciones"
        description="Dos canales complementarios: la campana dentro de la app y el push que llega aunque esté cerrada."
      >
        <FeatureList items={NOTIFICATION_FEATURES} />
      </Section>

      <Section
        icon={<Smartphone className="size-5" />}
        title="No me llegan los push con la app cerrada (Android)"
        description="La causa más habitual es el ahorro de batería del teléfono. Revisa estos tres puntos."
      >
        <ol className="grid gap-3 sm:grid-cols-3 sm:gap-x-6">
          {PUSH_TROUBLESHOOTING.map((step, i) => (
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

        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-outline-variant/40 bg-tertiary-container/40 px-4 py-3 text-sm text-on-surface">
          <BatteryCharging className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>
            <span className="font-medium">Marcas conocidas por ser agresivas con la batería:</span>{' '}
            Xiaomi (MIUI), Huawei, Samsung y Oppo. En estos, quitar Qleo de la
            optimización de batería suele ser lo que hace que los avisos vuelvan.
          </p>
        </div>

        <Accordion type="single" collapsible className="mt-4 w-full">
          <AccordionItem value="why">
            <AccordionTrigger className="text-on-surface hover:no-underline">
              <span className="flex items-center gap-2">
                <TriangleAlert className="size-4 text-on-surface-variant" />
                ¿Por qué pasa esto?
              </span>
            </AccordionTrigger>
            <AccordionContent className="text-on-surface-variant">
              Para ahorrar batería, algunos fabricantes «duermen» las apps que no usas de
              forma constante. Cuando eso ocurre, el teléfono deja de entregar los avisos
              hasta que abres la app. Instalar Qleo y excluirla del ahorro de batería
              mantiene el canal abierto.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Section>

      <div className="flex items-start gap-2.5 rounded-lg border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>
          Consejo: en iPhone y iPad, los push solo funcionan si primero añades Qleo a la
          pantalla de inicio desde Safari y abres la app desde ahí.
        </p>
      </div>
    </div>
  );
}
