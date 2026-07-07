import * as z from 'zod';

/**
 * Esquema del formulario de proyecto (crear/editar). Los campos de fecha se manejan
 * como `yyyy-mm-dd` (input date) y se convierten a ISO 8601 al enviar al backend.
 */
/** Claves de color válidas (paleta compartida, QL-29) + `''` para "sin color". */
export const projectColorEnum = z.enum([
  'blue',
  'orange',
  'green',
  'purple',
  'red',
  'pink',
  'gray',
]);

export const projectFormSchema = z
  .object({
    name: z.string().trim().min(1, 'El nombre es obligatorio'),
    code: z.string().trim().optional(),
    clientGroup: z.string().trim().optional(),
    destination: z.string().trim().optional(),
    description: z.string().trim().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    /** `''` = sin color; el form lo mapea a `null` en el payload. */
    color: z.union([projectColorEnum, z.literal('')]).optional(),
  })
  .refine(
    (data) =>
      !data.startDate || !data.endDate || data.startDate <= data.endDate,
    {
      message: 'La fecha de fin no puede ser anterior al inicio',
      path: ['endDate'],
    },
  );

export type ProjectFormValues = z.infer<typeof projectFormSchema>;
