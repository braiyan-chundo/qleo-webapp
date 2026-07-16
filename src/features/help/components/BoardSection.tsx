import {
  CalendarRange,
  FileText,
  GanttChartSquare,
  KanbanSquare,
  List,
  ListFilter,
  Settings2,
} from 'lucide-react';

import { Section, FeatureList, type HelpFeature } from './HelpPrimitives';

/** Las cinco vistas de un proyecto (verificadas en `ProjectDetailPage`). */
const VIEW_FEATURES: HelpFeature[] = [
  {
    icon: <KanbanSquare className="size-4 text-primary" />,
    term: 'Kanban',
    desc: 'Tarjetas organizadas en columnas de estado. Arrástralas entre columnas para avanzar el trabajo; el «+» de cada columna añade una tarea ahí.',
  },
  {
    icon: <List className="size-4 text-primary" />,
    term: 'List (Lista)',
    desc: 'Todas las tareas en una tabla, con sus propios filtros (por columna, orden) y exportación a CSV.',
  },
  {
    icon: <GanttChartSquare className="size-4 text-primary" />,
    term: 'Gantt',
    desc: 'Cronograma en el tiempo. Las barras usan la fecha de inicio y la fecha límite de cada tarea.',
  },
  {
    icon: <CalendarRange className="size-4 text-primary" />,
    term: 'Planner',
    desc: 'Planificación sobre un calendario, útil para repartir el trabajo por días.',
  },
  {
    icon: <FileText className="size-4 text-primary" />,
    term: 'Documentos',
    desc: 'Reúne en un solo lugar los archivos adjuntos del proyecto.',
  },
];

/** Herramientas del tablero. */
const BOARD_TOOLS: HelpFeature[] = [
  {
    icon: <ListFilter className="size-4 text-primary" />,
    term: 'Filtrar',
    desc: 'Acota lo que ves (por ejemplo por responsable o estado). Un contador indica cuántos filtros tienes activos.',
  },
  {
    icon: <Settings2 className="size-4 text-primary" />,
    term: 'Configurar tablero',
    desc: 'Gestiona las columnas del proyecto. Aparece en la cabecera cuando estás en la vista Kanban, y solo si eres el creador del proyecto, un Gestor o un administrador.',
  },
  {
    icon: <KanbanSquare className="size-4 text-primary" />,
    term: 'Backlog',
    desc: 'La columna por defecto donde caen las tareas nuevas si no eliges otra columna al crearlas.',
  },
];

export function BoardSection() {
  return (
    <div className="space-y-6">
      <Section
        icon={<KanbanSquare className="size-5" />}
        title="Vistas del proyecto"
        description="El mismo trabajo, mirado de cinco maneras. Cambia de pestaña dentro del proyecto."
      >
        <FeatureList items={VIEW_FEATURES} />
        <p className="mt-4 rounded-lg border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
          La vista que elijas se recuerda en la dirección del navegador, así que puedes
          copiar el enlace y compartir el proyecto ya abierto en Gantt, Planner, etc.
        </p>
      </Section>

      <Section
        icon={<Settings2 className="size-5" />}
        title="Filtrar y configurar"
        description="Cómo dar forma al tablero y encontrar tareas."
      >
        <FeatureList items={BOARD_TOOLS} />
      </Section>
    </div>
  );
}
