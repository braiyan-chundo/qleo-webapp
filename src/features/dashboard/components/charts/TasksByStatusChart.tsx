import type { TasksByStatus } from '../../services/dashboard.service';
import { CHART_COLORS } from './chart-utils';
import { CategoryBarChart, type CategoryBarRow } from './CategoryBarChart';

/**
 * Tareas por estado (QL-112): abiertas / cerradas / vencidas. Barras con color semántico
 * (cerradas=`primary`, abiertas=`tertiary`, vencidas=`error`). `overdue` es subconjunto de
 * `open` → se aclara en la nota al pie para no leerlo como suma.
 */
export function TasksByStatusChart({ data }: { data: TasksByStatus }) {
  const rows: CategoryBarRow[] = [
    { label: 'Abiertas', value: data.open, color: CHART_COLORS.secondary },
    { label: 'Cerradas', value: data.closed, color: CHART_COLORS.primary },
    { label: 'Vencidas', value: data.overdue, color: CHART_COLORS.error },
  ];

  return (
    <CategoryBarChart
      title="Tareas por estado"
      description="Distribución global de tareas del espacio."
      rows={rows}
      emptyMessage="Aún no hay tareas registradas."
      footnote="Las vencidas son un subconjunto de las abiertas (sin cerrar y con fecha límite pasada)."
    />
  );
}
