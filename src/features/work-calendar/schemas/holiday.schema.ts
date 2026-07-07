import * as z from 'zod';

/**
 * Esquema del formulario "Añadir festivo" (QL-10, §3.12). `date` (día en `YYYY-MM-DD` del
 * `<input type="date">`) y `name` son obligatorios. El backend normaliza a medianoche UTC.
 */
export const holidayFormSchema = z.object({
  date: z.string().min(1, 'Selecciona una fecha'),
  name: z.string().trim().min(1, 'El nombre es obligatorio'),
});

export type HolidayFormValues = z.infer<typeof holidayFormSchema>;
