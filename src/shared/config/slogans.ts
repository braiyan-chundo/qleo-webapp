/**
 * Eslogan diario de Qleo (QL-27).
 *
 * Qleo es un planner de tareas GENÉRICO (turismo/MICE es solo el primer vertical),
 * así que el shell muestra un eslogan neutro que rota una vez al día. La selección es
 * DETERMINISTA por día-del-año para ser estable entre renders (nada de `Math.random`,
 * que provocaría parpadeo) y cambiar cada día.
 */
export const SLOGANS: readonly string[] = [
  'Donde el trabajo fluye',
  'Proyectos en movimiento',
  'El ritmo de tu equipo',
  'Fluye, colabora y avanza',
  'Claridad en cada tarea',
  'Tu trabajo, sin complicaciones',
  'Menos caos, más acción',
  'El arte de organizar.',
  'Planifica. Colabora. Logra',
  'Organiza tu mundo',
  'Simplemente hazlo fluir.',
  'Tareas bajo control.',
];

/**
 * Devuelve el eslogan del día. Determinista: el mismo día siempre da la misma frase,
 * y cambia al día siguiente. Usa el día-del-año (0..365) en UTC para evitar saltos por
 * huso horario dentro de la misma jornada.
 */
export function getDailySlogan(date = new Date()): string {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  const dayOfYear = Math.floor(
    (Date.UTC(y, m, d) - Date.UTC(y, 0, 0)) / 86_400_000,
  );
  return SLOGANS[dayOfYear % SLOGANS.length];
}
