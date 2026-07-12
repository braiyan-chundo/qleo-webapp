import type { ProjectsByStatus } from '../../services/dashboard.service';
import { CHART_COLORS } from './chart-utils';
import { CategoryBarChart, type CategoryBarRow } from './CategoryBarChart';

/**
 * Proyectos por estado (QL-112): PLANNING / ACTIVE / CLOSING / COMPLETED. Barras de un solo
 * color (`primary`): la identidad la lleva la etiqueta del eje X, no el color (guía `dataviz`).
 * Los 4 valores suman el total de proyectos (archivados incluidos).
 */
export function ProjectsByStatusChart({ data }: { data: ProjectsByStatus }) {
  const rows: CategoryBarRow[] = [
    { label: 'Planeación', value: data.PLANNING, color: CHART_COLORS.primary },
    { label: 'Activos', value: data.ACTIVE, color: CHART_COLORS.primary },
    { label: 'En cierre', value: data.CLOSING, color: CHART_COLORS.primary },
    { label: 'Completados', value: data.COMPLETED, color: CHART_COLORS.primary },
  ];

  return (
    <CategoryBarChart
      title="Proyectos por estado"
      description="Estado derivado del avance de cada proyecto."
      rows={rows}
      emptyMessage="Aún no hay proyectos registrados."
    />
  );
}
