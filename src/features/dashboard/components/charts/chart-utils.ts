/**
 * Constantes y helpers (sin JSX) de las gráficas del panel ADMIN (QL-112). Separado de las
 * primitivas visuales para no romper el fast-refresh (`only-export-components`).
 *
 * Colores de las series: **tokens M3** vía `var(--…)` (definidos en `index.css`), así
 * respetan claro/oscuro sin hex. La identidad nunca va solo por color: cada gráfica lleva
 * etiqueta de eje o de dato (guía `dataviz`).
 */
export const CHART_COLORS = {
  /** Serie principal / valor "cerrado" (marca). */
  primary: 'var(--primary)',
  /** Serie secundaria / "abierto". */
  secondary: 'var(--tertiary)',
  /** Estado de error / "vencido". */
  error: 'var(--error)',
  /** Ejes y etiquetas (recesivos). */
  axis: 'var(--on-surface-variant)',
  /** Grilla (recesiva). */
  grid: 'var(--outline-variant)',
  /** Relleno del cursor de tooltip. */
  cursor: 'var(--surface-container)',
} as const;

/**
 * Formatea `YYYY-MM-DD` (UTC) a etiqueta corta `07 jul`. Se interpreta en UTC para no
 * desplazar el día por zona horaria (mismo criterio que la analítica QL-66).
 */
export function formatShortDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  });
}
