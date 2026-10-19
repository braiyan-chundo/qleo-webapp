import { AlarmClock, BellRing, CalendarDays, ClipboardList, EyeOff, Globe, Repeat, Wand2 } from 'lucide-react';

import { Section, FeatureList, type HelpFeature } from './HelpPrimitives';

/** Recordatorios personales (HU-0202, AC-28, D-20). Igual para todos los roles. */
const REMINDER_FEATURES: HelpFeature[] = [
  {
    icon: <EyeOff className="size-4 text-primary" />,
    term: 'Son tuyos y no son tareas',
    desc: 'Solo los ves tú. No aparecen en el tablero, ni en la analítica, ni avisan a nadie más, aunque los asocies a una tarea.',
  },
  {
    icon: <Repeat className="size-4 text-primary" />,
    term: 'Cinco formas de repetir',
    desc: 'Una vez; todos los días; ciertos días de la semana; fechas sueltas, cada una con su hora; o cada N horas dentro de una franja. Los que se repiten siguen hasta que los pauses o los borres.',
  },
  {
    icon: <Globe className="size-4 text-primary" />,
    term: 'Siempre en hora de Bogotá',
    desc: 'Las horas que eliges son de Bogotá, aunque tu teléfono esté en otra zona horaria.',
  },
  {
    icon: <CalendarDays className="size-4 text-primary" />,
    term: 'Días y horas no laborales',
    desc: 'Si no marcas las casillas, el aviso que cae en vacaciones, festivos, días no laborales o fuera de tu jornada se omite: no se mueve. El formulario te avisa antes de guardar.',
  },
  {
    icon: <ClipboardList className="size-4 text-primary" />,
    term: 'Desde una tarea',
    desc: 'En la tarea, la sección «Recordatorios» te deja añadir uno ya asociado. Si la tarea se completa o se descarta, deja de sonar hasta que se reabra.',
  },
  {
    icon: <Wand2 className="size-4 text-primary" />,
    term: 'Pídeselo al asistente',
    desc: 'En el asistente de IA, escribe o dicta qué quieres recordar y cuándo. Solo para ti: te pregunta la hora si falta y no crea nada hasta que confirmas la tarjeta. Editar, pausar o borrar se hace aquí.',
  },
  {
    icon: <BellRing className="size-4 text-primary" />,
    term: 'Cuando suena',
    desc: 'Te llega una notificación push y queda en tu campana. Al tocarla, abre la tarea o, si no tiene, esta vista.',
  },
];

export function RemindersSection() {
  return (
    <Section
      icon={<AlarmClock className="size-5" />}
      title="Recordatorios"
      description="Un aviso a la hora exacta para algo que debes hacer tú. Solo avisa: no se marca como hecho."
    >
      <FeatureList items={REMINDER_FEATURES} />
    </Section>
  );
}
