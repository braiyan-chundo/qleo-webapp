import type { Column } from '@/features/columns/services/columns.service';

/**
 * (QL-135, §3.33) Regla de **movimiento secuencial**: una tarea solo cambia a una columna
 * **contigua** a la de origen según `Column.order` — la siguiente o la anterior, nunca un
 * salto de dos o más. Va del orden de seguimiento: saltarse fases falsea el estado real.
 *
 * El **backend es la autoridad** (rechaza con 409 `COLUMN_SEQUENCE_VIOLATION`); esto solo
 * espeja la regla para que el usuario no descubra el límite a base de errores. Vive aquí
 * (y no inline en el board) para ser la **única fuente** en el front: el atenuado de las
 * columnas al arrastrar y el guard del `onDragEnd` deben decidir con la MISMA expresión,
 * o se desincronizan (el bug de QL-131).
 */

/**
 * ¿Es `dest` un destino válido para una tarea que está en `origin`?
 *
 * - **Reordenar dentro de la misma columna es libre**: no es un cambio de estado, y sale
 *   solo del `<= 1` (la distancia a sí misma es 0). El Backlog es una columna más, con su
 *   `order`: participa en la cadena sin trato especial.
 * - `bypassSequence` = quien puede **gestionar el proyecto** (ADMIN, creador o gestor
 *   otorgado, vía `canManageProject`): se salta la regla para recolocar de un tirón una
 *   tarjeta mal puesta. Para el resto —incluido el Creador de la tarea que no gestiona el
 *   proyecto— la regla es dura.
 * - Sin datos de alguna de las dos columnas **no se bloquea**: se deja pasar y decide el
 *   backend. La UI nunca debe ser más restrictiva que la autoridad.
 */
export function isColumnDropAllowed(
  origin: Column | undefined,
  dest: Column | undefined,
  bypassSequence: boolean,
): boolean {
  if (bypassSequence) return true;
  if (!origin || !dest) return true;
  return Math.abs(dest.order - origin.order) <= 1;
}
