import * as z from 'zod';

/**
 * Esquema del formulario de **ausencia** (QL-199, §3.71, Dirección).
 *
 * Las fechas se guardan como **día civil** `'YYYY-MM-DD'` literal (la cadena que se va a enviar,
 * no un `Date`): el backend rechaza un ISO con hora, y convertir con `toISOString()` en UTC-5
 * guardaría el día anterior.
 *
 * Lo que **no** se valida aquí y es deliberado: la duración máxima (366 días) y el **solape** con
 * otra ausencia del mismo tipo. Son reglas del servidor, que las resuelve contra los datos reales
 * y responde con `error.code` (`ABSENCE_TOO_LONG`, `ABSENCE_OVERLAP`); duplicarlas en el cliente
 * daría dos verdades que divergen. Sí se valida el orden `from ≤ to`, que es puro formulario y se
 * puede decir sin ir al servidor.
 */
export const absenceFormSchema = z
  .object({
    userId: z.string().min(1, 'Elige a la persona'),
    type: z.string().min(1, 'Elige el tipo de ausencia'),
    from: z.string().min(1, 'La fecha de inicio es obligatoria'),
    to: z.string().min(1, 'La fecha de fin es obligatoria'),
    note: z.string().max(500, 'La nota no puede superar los 500 caracteres').optional(),
  })
  .refine((values) => !values.from || !values.to || values.from <= values.to, {
    // Comparación lexicográfica: con `YYYY-MM-DD` de ancho fijo equivale a la cronológica.
    message: 'La fecha de fin no puede ser anterior a la de inicio',
    path: ['to'],
  });

export type AbsenceFormValues = z.infer<typeof absenceFormSchema>;
