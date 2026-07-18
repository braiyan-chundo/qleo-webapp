import * as z from 'zod';

import { hmToMinutes } from '../lib/shift';

/**
 * Esquema del formulario de un turno del catálogo (QL-163, §3.46). Las horas viajan como
 * `"HH:MM"` (lo que emite `<input type="time">`) y se convierten a minutos en el borde, al
 * mutar. El backend revalida el rango (`SHIFT_INVALID_RANGE`) y la unicidad del nombre
 * (`SHIFT_NAME_TAKEN`); aquí solo cubrimos lo evidente para no viajar en balde.
 */
export const shiftFormSchema = z
  .object({
    name: z.string().trim().min(1, 'El nombre es obligatorio'),
    start: z.string().regex(/^\d{1,2}:\d{2}$/, 'Hora de inicio inválida'),
    end: z.string().regex(/^\d{1,2}:\d{2}$/, 'Hora de fin inválida'),
    /** Hex `#RRGGBB`, o `null` si el turno no tiene color. */
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Color inválido')
      .nullable(),
    active: z.boolean(),
  })
  .refine(
    (values) => {
      const start = hmToMinutes(values.start);
      const end = hmToMinutes(values.end);
      return start !== null && end !== null && start < end;
    },
    { message: 'La hora de fin debe ser posterior a la de inicio', path: ['end'] },
  );

export type ShiftFormValues = z.infer<typeof shiftFormSchema>;
