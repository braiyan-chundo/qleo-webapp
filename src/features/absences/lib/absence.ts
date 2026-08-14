import { civilDayToDate, dateToCivilDay } from '@/shared/lib/civil-date';

import type { AbsenceCalendarItem, AbsentUser } from '../services/absences.service';

/**
 * Utilidades puras del feature **Ausencias** (QL-199, §3.71). Todo trabaja con **días civiles**
 * (`'YYYY-MM-DD'`, sin hora ni zona): las conversiones pasan por `@/shared/lib/civil-date`, nunca
 * por `toISOString()` — en UTC-5 eso guarda el día anterior.
 */

/** Tope del backend, en los dos sentidos: una ausencia y un rango consultado caben en 366 días. */
export const MAX_ABSENCE_RANGE_DAYS = 366;

/** Milisegundos de un día. Solo para diferencias entre fechas ancladas a mediodía. */
const DAY_MS = 24 * 60 * 60 * 1000;

/** Días civiles entre dos días, ambos incluidos. `null` si alguno no es un día válido. */
export function civilDaySpan(from: string, to: string): number | null {
  const start = civilDayToDate(from);
  const end = civilDayToDate(to);
  if (!start || !end) return null;
  return Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
}

/** Día civil desplazado `days` días. `''` si el origen no es válido. */
export function addCivilDays(value: string, days: number): string {
  const date = civilDayToDate(value);
  if (!date) return '';
  date.setDate(date.getDate() + days);
  return dateToCivilDay(date);
}

/**
 * Acota un rango al tope de 366 días del backend, recortando por el final.
 *
 * Existe para que un dedazo en el año (una tarea con fecha de fin en 2036) no convierta el aviso
 * de ausencias en un **400 `ABSENCE_RANGE_TOO_LONG`** que se lleve por delante todo el aviso. Con
 * el recorte, el rango consultado sigue empezando donde empieza la tarea y el aviso sigue
 * apareciendo; lo que se pierde es el final de un periodo que, a esa distancia, no informa de nada.
 */
export function clampCivilRange(
  from: string | undefined,
  to: string | undefined,
): { from?: string; to?: string } {
  if (!from || !to) return { from, to };
  const span = civilDaySpan(from, to);
  if (span === null) return { from, to };
  if (span <= 0) return { from, to: from };
  if (span <= MAX_ABSENCE_RANGE_DAYS) return { from, to };
  return { from, to: addCivilDays(from, MAX_ABSENCE_RANGE_DAYS - 1) };
}

/** ¿El día civil `day` cae dentro de `[from, to]`, ambos inclusivos? Comparación lexicográfica. */
export function civilDayInRange(day: string, from: string, to: string): boolean {
  return day >= from && day <= to;
}

/**
 * Posición de un día dentro del rango de una ausencia. Es lo que permite dibujar una barra
 * continua con extremos distinguibles: un `start` sin `end` significa "sigue después", y al revés.
 */
export interface AbsenceDayPosition {
  isStart: boolean;
  isEnd: boolean;
}

/** Una ausencia que toca un día concreto, con su posición en ese día. */
export interface AbsenceOnDay {
  absence: AbsenceCalendarItem;
  position: AbsenceDayPosition;
}

/**
 * Indexa las ausencias por día civil (`'YYYY-MM-DD'`), expandiendo cada rango en sus días.
 *
 * Es **una lista por día, no una sola**: varias personas pueden estar fuera el mismo día, y
 * quedarse con la primera sería un fallo silencioso (mismo criterio que `groupBirthdaysByDate`,
 * QL-193).
 *
 * La expansión se acota a `[gridFrom, gridTo]` —los días que la vista realmente pinta—: el backend
 * devuelve los rangos **sin recortar** a propósito, así que unas vacaciones de tres meses no deben
 * generar 90 entradas para pintar un mes. La posición (`isStart`/`isEnd`) se calcula contra las
 * fechas **reales** de la ausencia, no contra el recorte, para que un rango que viene de antes se
 * dibuje como continuación y no como si empezara el día 1.
 */
export function groupAbsencesByDay(
  absences: AbsenceCalendarItem[],
  gridFrom: string,
  gridTo: string,
): Map<string, AbsenceOnDay[]> {
  const byDay = new Map<string, AbsenceOnDay[]>();

  for (const absence of absences) {
    const start = absence.from > gridFrom ? absence.from : gridFrom;
    const end = absence.to < gridTo ? absence.to : gridTo;
    if (start > end) continue;

    const span = civilDaySpan(start, end);
    if (span === null || span <= 0) continue;

    let day = start;
    for (let i = 0; i < span; i += 1) {
      const entry: AbsenceOnDay = {
        absence,
        position: { isStart: day === absence.from, isEnd: day === absence.to },
      };
      const bucket = byDay.get(day);
      if (bucket) bucket.push(entry);
      else byDay.set(day, [entry]);

      day = addCivilDays(day, 1);
      if (!day) break;
    }
  }

  return byDay;
}

/** Etiqueta corta de un día civil dentro del aviso ("26 de agosto"). Sin año: es el periodo cercano. */
export function formatAbsenceDay(value: string): string {
  const date = civilDayToDate(value);
  if (!date) return value;
  return date.toLocaleDateString('es', { day: 'numeric', month: 'long' });
}

/**
 * Vocabulario del aviso, **fuera de la pantalla de Dirección**. Solo tiene entradas para los dos
 * tipos que el backend considera públicos; **cualquier otra cosa cae en "no está disponible"**.
 *
 * El default no es pereza: en un formulario de tarea, quien mira puede ser Dirección, y para
 * Dirección el backend **desenmascara** el tipo real. Escribirlo ahí sacaría una incapacidad a una
 * pantalla compartida —y a un aviso que se lee de pasada— cuando el dato solo hace falta en la
 * pantalla de Ausencias. Lo que el aviso necesita saber es "no está y vuelve el X"; el tipo exacto
 * no cambia la decisión.
 */
const ABSENCE_PHRASE: Record<string, { verb: string; short: string }> = {
  VACATION: { verb: 'está de vacaciones', short: 'Vacaciones' },
  OUT_OF_OFFICE: { verb: 'está fuera de oficina', short: 'Fuera de oficina' },
};

const UNAVAILABLE_PHRASE = { verb: 'no está disponible', short: 'No disponible' } as const;

/** Frase para el tipo del primer periodo, con el "no disponible" como default seguro. */
function phraseOf(absent: AbsentUser) {
  const type = absent.periods[0]?.type;
  return (type && ABSENCE_PHRASE[type]) || UNAVAILABLE_PHRASE;
}

/**
 * Frase de aviso para una persona ausente (§3.71 §2), con el copy del contrato:
 * *"Ana Gómez está de vacaciones hasta el 25 de agosto (vuelve el 26)."* · con tipo reservado,
 * *"Ana Gómez no está disponible hasta el 25 de agosto (vuelve el 26)."*
 *
 * Dos cosas que NO se hacen aquí, a propósito:
 * - **No se compone el motivo.** Si el tipo no es uno de los públicos, se escribe "no está
 *   disponible" y punto: ni "motivo reservado", ni iconografía médica, ni nada que invite a
 *   suponer de qué tipo es.
 * - **No se calcula la vuelta.** `returnsOn` ya viene **encadenado** con las ausencias
 *   consecutivas; sumarle un día al `to` daría "vuelve el 21" cuando la persona vuelve el 26.
 */
export function absenceNotice(absent: AbsentUser): string {
  const until = formatAbsenceDay(absent.to);
  const back = formatAbsenceDay(absent.returnsOn);

  const core = `${absent.name} ${phraseOf(absent).verb} hasta el ${until} (vuelve el ${back}).`;
  if (absent.coversWholeRange) return core;
  return `${core} No está disponible parte del periodo de la tarea.`;
}

/** Marca compacta para el selector de responsables ("Vacaciones · vuelve el 26 de agosto"). */
export function absenceOptionSuffix(absent: AbsentUser): string {
  return `${phraseOf(absent).short} · vuelve el ${formatAbsenceDay(absent.returnsOn)}`;
}
