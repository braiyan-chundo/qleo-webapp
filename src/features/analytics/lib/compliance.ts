import type {
  ComplianceTrendDirection,
  UserPerformance,
} from '../services/analytics.service';

/**
 * QL-200 (§3.72 §5) — **Cómo se enseña el cumplimiento sin señalar a nadie.**
 *
 * El backend hace su parte: nunca devuelve `NaN`, ni un `100 %` de regalo, ni un `0 %` por falta
 * de datos — devuelve `null` y el tamaño de la muestra. La parte del front es no deshacer eso, y
 * es más fácil de romper de lo que parece: un `?? 0` en el render, un `sort` por
 * `complianceRate`, un `toFixed()` defensivo… y la pantalla que lee Dirección pasa a decir que
 * una persona cumple el 0 % cuando lo que ocurre es que **nadie le puso fecha a sus tareas**.
 *
 * Estado real medido en el clon de producción: **4 de 64 tareas** tienen fecha de fin, **los 9
 * usuarios activos** salen con `complianceReliable: false` y dos dan `complianceRate: 0` con una
 * muestra de **2**. O sea: el caso "no fiable" **es** la vista normal, no el borde.
 *
 * Por eso la decisión de qué pintar vive aquí y no en el JSX: una sola función devuelve una unión
 * discriminada y el componente solo **elige la rama**, sin poder inventarse un número.
 */

/**
 * Qué se puede decir del cumplimiento de una persona.
 *
 * - `measured` — hay muestra suficiente: el porcentaje **es** un dato y se puede rankear.
 * - `insufficient` — hay algún compromiso juzgable, pero no bastan. El `rate` viaja **solo para
 *   el tooltip**, etiquetado como no concluyente; nunca como cifra principal.
 * - `unmeasurable` — ni un compromiso que juzgar (`complianceRate === null`). No hay porcentaje
 *   que enseñar en ninguna forma.
 */
export type ComplianceDisplay =
  | { kind: 'measured'; rate: number; onTime: number; sample: number }
  | {
      kind: 'insufficient';
      /** Existe, pero **no significa nada todavía**. Solo para texto auxiliar. */
      inconclusiveRate: number;
      sample: number;
      /** Muestra mínima configurada, si se conoce (`GET /settings/management-alerts`). */
      minSample?: number;
    }
  | { kind: 'unmeasurable'; minSample?: number };

/**
 * Resuelve qué enseñar en la celda de cumplimiento de una fila.
 *
 * `minSample` (el `complianceMinSample` de los umbrales) es **opcional** a propósito: solo sirve
 * para poder decir *"2 de 5 compromisos necesarios"*. Si no se conoce —porque los umbrales aún no
 * cargaron o la petición falló— se calla el denominador, pero **no** se degrada a pintar el
 * porcentaje: la fiabilidad la decide `complianceReliable`, que ya viene resuelto.
 */
export function complianceDisplay(
  row: Pick<
    UserPerformance,
    'complianceRate' | 'complianceReliable' | 'complianceSample' | 'complianceOnTime'
  >,
  minSample?: number,
): ComplianceDisplay {
  // `null` = no hay ni un compromiso juzgable. Va PRIMERO: es el caso en el que cualquier número
  // sería inventado.
  if (row.complianceRate === null) return { kind: 'unmeasurable', minSample };

  if (!row.complianceReliable) {
    return {
      kind: 'insufficient',
      inconclusiveRate: row.complianceRate,
      sample: row.complianceSample,
      minSample,
    };
  }

  return {
    kind: 'measured',
    rate: row.complianceRate,
    onTime: row.complianceOnTime,
    sample: row.complianceSample,
  };
}

/** ¿La fila tiene un cumplimiento que se pueda pintar como dato (y rankear)? */
export function isComplianceMeasured(row: UserPerformance): boolean {
  return row.complianceReliable && row.complianceRate !== null;
}

/**
 * Frase que **explica el hueco** de una fila sin muestra, o `null` si no hay nada que explicar.
 *
 * Es la diferencia entre acusar a alguien y decir por qué no se le puede medir: en cuanto se ve
 * *"5 de sus 7 tareas pendientes no tienen fecha de fin"*, el vacío deja de parecer un mal
 * resultado y pasa a ser una tarea de gestión concreta.
 */
export function missingDatesHint(row: UserPerformance): string | null {
  if (row.pendingWithoutDueDate <= 0) return null;
  const total = row.pendingTasks;
  const n = row.pendingWithoutDueDate;
  const plural = n === 1 ? 'tarea pendiente no tiene' : 'tareas pendientes no tienen';
  return total > n
    ? `${n} de sus ${total} ${plural} fecha de fin: no se pueden medir.`
    : `Sus ${n} ${plural} fecha de fin: no se pueden medir.`;
}

/** Cómo se pinta cada dirección de la tendencia (§3.72 §3). */
export interface TrendPresentation {
  label: string;
  /** Texto largo del tooltip. */
  hint: string;
  /** `'up' | 'down' | 'flat' | 'none'` — `'none'` = **sin flecha**, no es "estable". */
  arrow: 'up' | 'down' | 'flat' | 'none';
  /** Clase de token M3 del texto/icono. */
  className: string;
}

/**
 * Presentación de cada `direction`. Ojo con `INSUFFICIENT_DATA`: **no** se pinta como `STABLE`.
 * Son cosas distintas —"no se movió" vs. "no hay con qué comparar"— y confundirlas le dice a
 * Dirección que una persona está estancada cuando lo que pasa es que no tiene historial.
 */
export const TREND_PRESENTATION: Record<ComplianceTrendDirection, TrendPresentation> = {
  IMPROVING: {
    label: 'Mejora',
    hint: 'Cumple mejor que en el periodo anterior (más de 5 puntos por encima).',
    arrow: 'up',
    className: 'text-tertiary',
  },
  WORSENING: {
    label: 'Empeora',
    hint: 'Cumple peor que en el periodo anterior (más de 5 puntos por debajo).',
    arrow: 'down',
    className: 'text-error',
  },
  STABLE: {
    label: 'Estable',
    hint: 'Sin cambios relevantes: la diferencia no llega a 5 puntos, que con muestras pequeñas es ruido.',
    arrow: 'flat',
    className: 'text-on-surface-variant',
  },
  INSUFFICIENT_DATA: {
    label: 'Sin comparación',
    hint: 'Alguno de los dos periodos no tiene compromisos con fecha, así que no hay tendencia que calcular. No significa que esté estable.',
    arrow: 'none',
    className: 'text-on-surface-variant',
  },
};

/** Orden de la tabla de rendimiento. El default es el que ya sirve el backend. */
export type PerformanceSort = 'efficiency' | 'compliance';

/**
 * Ordena las filas para pintarlas.
 *
 * - `'efficiency'` → **no toca nada**: el backend ya las manda ordenadas por `efficiency` desc.
 * - `'compliance'` → **peor cumplimiento primero** (es lo que Dirección busca al ordenar por
 *   esta columna: a quién hay que atender), pero **las filas sin muestra suficiente van siempre
 *   al final**, nunca encabezando la lista de peores.
 *
 * Ese último detalle es la regla entera de QL-200 en una línea de código: un `rate ?? 0` pondría
 * arriba del todo, como los peores del equipo, exactamente a las personas de las que **no se sabe
 * nada**. Se desempata por muestra desc: entre dos porcentajes iguales, manda el mejor medido.
 */
export function sortPerformance(
  rows: readonly UserPerformance[],
  sort: PerformanceSort,
): UserPerformance[] {
  if (sort === 'efficiency') return [...rows];

  return [...rows].sort((a, b) => {
    const aMeasured = isComplianceMeasured(a);
    const bMeasured = isComplianceMeasured(b);
    // Los no medibles no compiten: se hunden, en el orden en que venían.
    if (aMeasured !== bMeasured) return aMeasured ? -1 : 1;
    if (!aMeasured) return 0;
    const rateDiff = (a.complianceRate as number) - (b.complianceRate as number);
    if (rateDiff !== 0) return rateDiff;
    return b.complianceSample - a.complianceSample;
  });
}
