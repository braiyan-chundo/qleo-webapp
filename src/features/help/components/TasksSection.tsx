import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  AtSign,
  CalendarClock,
  CalendarOff,
  CalendarPlus,
  CheckCircle2,
  ListChecks,
  MousePointerClick,
  Paperclip,
  Tag,
  Timer,
  UserCog,
  Users,
} from 'lucide-react';

import { Section, FeatureList, type HelpFeature } from './HelpPrimitives';

/** Ciclo de vida de una tarea (QL-126). Verificado contra el detalle de tarea real. */
const TASK_STEPS: { title: string; body: ReactNode }[] = [
  {
    // (QL-197) Las dos fechas pasaron a ser obligatorias en el alta: es lo primero que hay que
    // saber antes de pulsar "Nueva tarea", así que se dice en el paso 1.
    title: 'Se crea',
    body: 'Con un título, una fecha de inicio y una fecha de finalización (las tres obligatorias) y una columna. Puedes fijar Responsable, Colaboradores y etiqueta desde el primer momento.',
  },
  {
    title: 'Se trabaja',
    body: 'Comentarios, checklist, adjuntos y cronómetro. La tarea avanza moviéndola entre columnas del tablero.',
  },
  {
    title: 'Se completa',
    body: 'El Creador o el Responsable la cierra con un resumen de resultados (obligatorio salvo adjunto probatorio).',
  },
  {
    title: 'Se puede reabrir',
    body: 'Si hace falta retomarla, el Creador o el Responsable la reabren: vuelve a estar en curso y se limpia el resumen. El tiempo cronometrado se conserva.',
  },
];

/** Anatomía de una tarea: cada bloque existe hoy en la vista de detalle. */
const TASK_FEATURES: HelpFeature[] = [
  {
    icon: <Users className="size-4 text-primary" />,
    term: 'Responsable y Colaboradores',
    desc: 'Un único Responsable rinde cuentas del cierre; los Colaboradores apoyan. Se eligen entre los miembros del proyecto. Toda tarea tiene Responsable: por defecto, quien la crea.',
  },
  {
    icon: <CalendarClock className="size-4 text-primary" />,
    term: 'Fecha de finalización',
    desc: 'Obligatoria. El Creador puede bloquearla; si está bloqueada, el Responsable o los Colaboradores pueden solicitar una prórroga. Si la fecha cae en festivo o fin de semana, Qleo lo avisa (no bloquea).',
  },
  {
    // (QL-197) La única excepción a la fecha de fin obligatoria, y su coste: la tarea nace
    // bloqueada. Se documenta porque quien la marca sin saberlo cree que la tarea está rota.
    icon: <CalendarOff className="size-4 text-primary" />,
    term: 'Sin fecha de finalización (excepción)',
    desc: 'Si una tarea de verdad no puede tener fecha de fin, al crearla marca «Sin fecha de finalización», elige a quién de Dirección se lo pides y explica por qué. La tarea nace BLOQUEADA —no se mueve ni se completa, aunque sí se comenta y se edita— hasta que Dirección responda. Si deniegan, la salida es ponerle una fecha: al hacerlo la solicitud se cancela sola.',
  },
  {
    icon: <ListChecks className="size-4 text-primary" />,
    term: 'Checklist',
    desc: 'Divide la tarea en sub-tareas marcables para seguir el progreso con detalle.',
  },
  {
    icon: <AtSign className="size-4 text-primary" />,
    term: 'Comentarios con @menciones',
    desc: 'Conversa dentro de la tarea; menciona con «@» para avisar a un participante (le llega una notificación).',
  },
  {
    icon: <Paperclip className="size-4 text-primary" />,
    term: 'Adjuntos',
    desc: 'Sube archivos de apoyo o probatorios. Un adjunto probatorio permite cerrar la tarea aunque no escribas resumen.',
  },
  {
    icon: <Timer className="size-4 text-primary" />,
    term: 'Cronómetro',
    desc: 'Inicia y detén el tiempo trabajado. Se muestra el total, un contador en vivo mientras corre y el desglose por persona.',
  },
  {
    icon: <Tag className="size-4 text-primary" />,
    term: 'Etiqueta',
    desc: 'Una etiqueta corta (p. ej. VUELOS) para clasificar la tarjeta de un vistazo.',
  },
  {
    icon: <CalendarPlus className="size-4 text-primary" />,
    term: 'Fecha de inicio',
    desc: 'Obligatoria y sin excepciones: marca cuándo arranca la tarea y, junto a la de finalización, alimenta la barra de la vista Gantt. Se puede cambiar, pero no dejar en blanco.',
  },
  {
    icon: <CheckCircle2 className="size-4 text-primary" />,
    term: 'Cierre con resumen',
    desc: 'Completar exige un resumen de resultados (o un adjunto probatorio). Siempre puedes reabrir después.',
  },
];

export function TasksSection() {
  return (
    <div className="space-y-6">
      <Section
        icon={<ListChecks className="size-5" />}
        title="El ciclo de una tarea"
        description="De su alta hasta el cierre, y cómo reabrirla si hace falta."
      >
        <ol className="grid gap-3 sm:grid-cols-2 sm:gap-x-8 lg:grid-cols-4">
          {TASK_STEPS.map((step, i) => (
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

      <Section
        icon={<UserCog className="size-5" />}
        title="Qué contiene una tarea"
        description="Todo lo que puedes gestionar dentro de su ficha."
      >
        <FeatureList items={TASK_FEATURES} />

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-outline-variant/40 bg-surface-container-low p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-on-surface">
              <MousePointerClick className="size-4 text-primary" />
              Cómo abrir una tarea
            </p>
            <p className="mt-1 text-sm text-on-surface-variant">
              En el Kanban, un clic en la tarjeta abre la vista completa de la tarea. En
              Lista, Gantt y Planner el clic abre un vistazo rápido en una ventana.
            </p>
          </div>
          <div className="rounded-lg border border-outline-variant/40 bg-surface-container-low p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-on-surface">
              <ListChecks className="size-4 text-primary" />
              Todas tus tareas
            </p>
            <p className="mt-1 text-sm text-on-surface-variant">
              En{' '}
              <Link to="/tasks" className="font-medium text-primary hover:underline">
                Mis tareas
              </Link>{' '}
              reúnes las tareas donde participas; puedes ordenarlas por fecha límite o
              agruparlas por proyecto.
            </p>
          </div>
        </div>
      </Section>
    </div>
  );
}
