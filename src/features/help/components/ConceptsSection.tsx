import {
  CalendarClock,
  CalendarDays,
  Info,
  KanbanSquare,
  Layers,
  Lock,
  Tag,
  Timer,
  Users,
} from 'lucide-react';

import { Section, ConceptGrid, type HelpConcept } from './HelpPrimitives';

const CONCEPTS: HelpConcept[] = [
  {
    term: 'Proyecto · Etapa · Columna',
    icon: <Layers className="size-4 text-primary" />,
    desc: 'El proyecto es el contenedor. Dentro, las etapas agrupan tareas por bloques y las columnas representan el flujo del Kanban.',
  },
  {
    term: 'Backlog',
    icon: <KanbanSquare className="size-4 text-primary" />,
    desc: 'La columna por defecto del tablero: ahí caen las tareas nuevas cuando no eliges otra columna al crearlas.',
  },
  {
    term: 'Fecha límite y bloqueo',
    icon: <Lock className="size-4 text-primary" />,
    desc: 'Cada tarea puede tener fecha límite. El Creador puede bloquearla para que Responsable y Colaboradores no la cambien.',
  },
  {
    term: 'Calendario laboral',
    icon: <CalendarDays className="size-4 text-primary" />,
    desc: 'Días hábiles y festivos. Si una fecha límite cae en festivo o fin de semana, Qleo lo avisa (no reprograma nada por su cuenta).',
  },
  {
    term: 'Fecha de inicio vs. fecha límite',
    icon: <CalendarClock className="size-4 text-primary" />,
    desc: 'La de inicio marca cuándo arranca la tarea; la límite, cuándo debe estar lista. Juntas dibujan la barra de la vista Gantt.',
  },
  {
    term: 'Resumen de cierre',
    icon: <KanbanSquare className="size-4 text-primary" />,
    desc: 'No se cierra una tarea sin un resumen de lo realizado, salvo que adjuntes un archivo probatorio. Queda como registro.',
  },
  {
    term: 'Tiempo trabajado',
    icon: <Timer className="size-4 text-primary" />,
    desc: 'El cronómetro de cada tarea suma el tiempo por persona. El total se conserva aunque la tarea se reabra.',
  },
  {
    term: 'Etiqueta',
    icon: <Tag className="size-4 text-primary" />,
    desc: 'Una palabra corta en la tarjeta para clasificarla de un vistazo (por ejemplo VUELOS u HOTELES).',
  },
  {
    term: 'Membresía y visibilidad',
    icon: <Users className="size-4 text-primary" />,
    desc: 'Solo los miembros de un proyecto lo ven y trabajan en él. Los roles de una tarea se eligen entre esa membresía.',
  },
];

export function ConceptsSection() {
  return (
    <Section
      icon={<Info className="size-5" />}
      title="Conceptos clave"
      description="Los términos que conviene tener claros."
    >
      <ConceptGrid items={CONCEPTS} />
    </Section>
  );
}
