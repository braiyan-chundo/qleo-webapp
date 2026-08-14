import { Plane, UserMinus } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { AbsenceOnDay } from '../lib/absence';
import { MASKED_ABSENCE_TYPE } from '../services/absences.service';

/**
 * (QL-199) Estilo del chip de ausencia, **compartido por las dos vistas de calendario** — mismo
 * papel que `BIRTHDAY_CHIP` (QL-193) en `features/work-calendar/lib/work-calendar`.
 *
 * ## Por qué se distingue por FORMA y no por color
 *
 * No quedaba ningún rol M3 libre en las dos vistas a la vez, y ese fue el mismo callejón que se
 * encontró QL-193: en `WorkCalendarView`, `tertiary-container` = festivo automático y
 * `secondary-container` = festivo manual; en `MemberCalendarView`, `primary-container` = **día con
 * turno** y `secondary-container` = festivo. Cualquier relleno que se eligiera aquí ya significa
 * otra cosa en la vista de al lado. `error-container` y `warning-container` estaban técnicamente
 * libres, pero una ausencia no es un error ni un aviso de problema: pintarla en rojo o ámbar
 * diría algo falso sobre una persona que simplemente está de vacaciones.
 *
 * La distinción elegida es la que **solo la ausencia puede tener**: es el único elemento del
 * calendario que es un **rango**, no un día suelto. Así quedan tres ejes que no colisionan:
 *
 * | Elemento | Cómo se distingue |
 * |---|---|
 * | Festivo / fin de semana / turno | **relleno** de la celda (tipo de día) |
 * | Cumpleaños (QL-193) | chip con **borde discontinuo** (evento puntual) |
 * | **Ausencia** | **barra continua** con borde sólido, acento a la izquierda e **icono de persona** |
 *
 * La barra además comunica lo correcto: los extremos se redondean solo donde la ausencia empieza
 * o termina de verdad, así que un periodo que **viene de antes** o **sigue después** se lee de un
 * vistazo, sin recortar el dato ni pedir otra llamada.
 *
 * Como el cumpleaños, la ausencia **anota** el día: no lo reclasifica. No entra en el conteo de
 * días laborables ni cambia si la jornada es hábil (§3.71 §8).
 */
export const ABSENCE_CHIP =
  'flex items-center gap-0.5 border border-outline-variant bg-surface-container-highest ' +
  'px-1 py-0.5 text-[10px] leading-tight font-medium text-on-surface';

/**
 * Redondeo según dónde cae el día dentro del rango: extremos redondeados, continuación recta y sin
 * borde lateral, para que dos días seguidos se lean como **una** barra y no como dos etiquetas.
 *
 * El acento de color va en un elemento aparte (`AbsenceAccent`) y no como `border-l-<color>`: esa
 * variante depende del orden en que Tailwind emite `border-color` y `border-left-color`, y basta
 * un cambio de versión para que el acento desaparezca sin que nada falle.
 */
function shapeFor(position: { isStart: boolean; isEnd: boolean }): string {
  return cn(
    position.isStart ? 'rounded-l' : 'rounded-l-none border-l-0',
    position.isEnd ? 'rounded-r' : 'rounded-r-none border-r-0',
  );
}

/** Marca vertical del **inicio** del periodo. Nunca es un tipo de día: solo abre la barra. */
function AbsenceAccent() {
  return (
    <span
      className="mr-0.5 h-3 w-0.5 shrink-0 rounded-full bg-tertiary"
      aria-hidden
    />
  );
}

interface AbsenceDayChipProps {
  /** Ausencias que tocan **ese** día. Lista: varias personas pueden estar fuera a la vez. */
  entries: AbsenceOnDay[];
  className?: string;
}

/**
 * Chip de ausencia de un día del calendario.
 *
 * ⚠️ **Privacidad (§3.71 §1):** pinta `typeLabel` **tal cual llega**. El backend ya enmascara los
 * tres tipos reservados como "No disponible", y aquí no se deduce nada ni se añade iconografía que
 * invite a suponer el motivo: el icono de un tipo enmascarado es una persona ausente genérica,
 * nunca algo médico. La **nota** no llega por este canal para nadie, así que no hay nada que
 * ocultar a mano.
 */
export function AbsenceDayChip({ entries, className }: AbsenceDayChipProps) {
  if (entries.length === 0) return null;

  const [first] = entries;
  const extra = entries.length - 1;
  // Con varias personas el chip no cabe: la barra se dibuja con la posición de la primera y los
  // nombres completos viven en el `title` de la celda.
  const masked = first.absence.type === MASKED_ABSENCE_TYPE;
  const Icon = masked ? UserMinus : Plane;

  return (
    <span className={cn(ABSENCE_CHIP, shapeFor(first.position), className)}>
      {first.position.isStart && <AbsenceAccent />}
      <Icon className="size-3 shrink-0 text-tertiary" aria-hidden />
      <span className="truncate">
        {extra > 0 ? `${entries.length} ausentes` : first.absence.name}
      </span>
    </span>
  );
}

/**
 * Línea de la leyenda, para que la barra se entienda sin pasar el cursor. Se usa junto a las
 * muestras de color de cada vista — y **no** es una muestra de color, precisamente porque la
 * ausencia no es un tipo de día.
 */
export function AbsenceLegendItem() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-flex h-3.5 w-6 items-center rounded-l rounded-r-none border border-r-0 border-outline-variant bg-surface-container-highest pl-0.5"
        aria-hidden
      >
        <span className="h-2 w-0.5 rounded-full bg-tertiary" />
      </span>
      Ausencia
    </span>
  );
}
