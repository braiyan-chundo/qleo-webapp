import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LifeBuoy } from 'lucide-react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

import { useIsAdmin } from '../hooks/use-is-admin';
import { AdminOnlyBadge, Section } from './HelpPrimitives';

/**
 * Preguntas frecuentes. `adminOnly` sigue la misma regla que las primitivas (QL-128): la
 * pregunta se le oculta a un MEMBER y se le marca con el badge a un ADMIN.
 */
const FAQS: { q: string; a: ReactNode; adminOnly?: boolean }[] = [
  {
    q: '¿Puedo tener varios responsables en una tarea?',
    a: 'No. Cada tarea tiene un único Responsable para dejar clara la rendición de cuentas. Sí puedes añadir varios Colaboradores.',
  },
  {
    q: '¿Por qué no veo el botón «Nuevo proyecto»?',
    a: (
      <>
        Porque crear proyectos requiere permiso y aún no lo tienes. Pídeselo a un
        administrador: él lo activa en un momento desde la administración de usuarios. Los
        administradores siempre pueden crear proyectos.
      </>
    ),
  },
  {
    q: '¿Cómo dejo que un miembro cree proyectos?',
    adminOnly: true,
    a: (
      <>
        En{' '}
        <Link to="/admin" className="font-medium text-primary hover:underline">
          Administración
        </Link>
        , pulsa «Editar» en el usuario y activa «Puede crear proyectos». Por defecto los
        miembros no pueden; a un administrador no le hace falta (siempre puede).
      </>
    ),
  },
  {
    q: '¿Puedo cambiar el correo de soporte que ve el equipo?',
    adminOnly: true,
    a: 'Sí. Está en la pestaña «Soporte» de esta misma Ayuda: pulsa «Editar» junto a la dirección, escribe la nueva y guarda. El cambio lo ve todo el equipo al instante.',
  },
  {
    q: '¿Por qué no puedo configurar el tablero de un proyecto?',
    a: 'Configurar el tablero (las columnas) está reservado al creador del proyecto, a sus Gestores y a los administradores. Además, el botón solo aparece en la vista Kanban.',
  },
  {
    q: '¿Por qué no me llegan los push con la app cerrada (Android)?',
    a: (
      <>
        Casi siempre es el ahorro de batería del teléfono. Revisa que las notificaciones
        estén activadas, instala Qleo como app y quítala de la optimización de batería
        (Xiaomi/MIUI, Huawei, Samsung y Oppo son las marcas más agresivas). Tienes el paso
        a paso en la pestaña <span className="font-medium text-on-surface">Notificaciones</span>.
      </>
    ),
  },
  {
    q: '¿El clic en la tarjeta ya no abre el modal?',
    a: 'En el Kanban, un clic en la tarjeta abre directamente la vista completa de la tarea (ya no el modal de vistazo rápido). En las vistas Lista, Gantt y Planner el clic sí abre el vistazo rápido en una ventana.',
  },
  {
    q: '¿Qué es el indicador «escribiendo…» del muro?',
    a: 'Es una señal en vivo, al estilo de las apps de mensajería: te avisa cuando alguien está escribiendo o grabando un audio en el muro. Desaparece solo cuando termina.',
  },
  {
    q: '¿Dónde veo mis proyectos recientes?',
    a: (
      <>
        En{' '}
        <Link to="/" className="font-medium text-primary hover:underline">
          Inicio
        </Link>
        , el bloque «Proyectos recientes» te lleva de vuelta a los proyectos que abriste
        últimamente.
      </>
    ),
  },
  {
    q: 'Silencié el muro, pero me siguen llegando avisos. ¿Por qué?',
    a: 'Silenciar el muro corta el aviso de cada mensaje nuevo, pero las @menciones siempre llegan: si alguien te menciona, se te notifica igualmente.',
  },
  {
    q: '¿Por qué no puedo cambiar la fecha límite de una tarea?',
    a: 'Probablemente el Creador la bloqueó. Puedes solicitarle una prórroga desde la propia tarea; solo él puede desbloquearla o moverla.',
  },
  {
    q: '¿Por qué me pide un resumen al completar una tarea?',
    a: 'El resumen deja constancia de lo realizado y da trazabilidad al cierre. Es obligatorio, salvo que adjuntes un archivo probatorio.',
  },
  {
    q: '¿Qué diferencia hay entre archivar y eliminar un proyecto?',
    a: 'Archivar lo saca de la vista activa pero conserva su contenido; siempre puedes consultarlo en la pestaña «Archivados». Eliminar sí es definitivo.',
  },
  {
    q: '¿Cómo instalo Qleo como aplicación?',
    a: 'Desde el menú de tu navegador: «Instalar app» en escritorio, o «Añadir a pantalla de inicio» en el móvil. Instalada mejora la recepción de notificaciones push y muestra el número de avisos en el icono.',
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

export function FaqSection() {
  const isAdmin = useIsAdmin();
  const visible = FAQS.filter((faq) => !faq.adminOnly || isAdmin);

  return (
    <Section
      icon={<LifeBuoy className="size-5" />}
      title="Preguntas frecuentes"
      description="Las dudas más habituales."
    >
      <Accordion type="single" collapsible className="w-full">
        {visible.map((faq) => (
          <AccordionItem key={faq.q} value={faq.q}>
            <AccordionTrigger className="text-left text-on-surface hover:no-underline">
              <span className="flex flex-wrap items-center gap-2">
                {faq.q}
                {faq.adminOnly && <AdminOnlyBadge />}
              </span>
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
