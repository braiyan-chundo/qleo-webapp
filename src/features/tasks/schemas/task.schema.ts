import * as z from 'zod';

/**
 * Esquema del formulario de tarea (crear/editar). `title` y `stageId` son obligatorios;
 * `columnId` es opcional (si se omite el backend usa la columna default del proyecto).
 */
export const taskFormSchema = z.object({
  title: z.string().trim().min(1, 'El título es obligatorio'),
  description: z.string().trim().optional(),
  stageId: z.string().min(1, 'Selecciona una etapa'),
  columnId: z.string().optional(),
  /** Categoría corta opcional (p.ej. "VUELOS"). */
  label: z.string().trim().optional(),
  /** Fecha de inicio opcional (valor de `<input type="date">`, `YYYY-MM-DD`). */
  startDate: z.string().optional(),
});

export type TaskFormValues = z.infer<typeof taskFormSchema>;

/**
 * Esquema del formulario de "Solicitar prórroga" (QL-09, §3.7). Un no-Creador propone una
 * nueva fecha (obligatoria) y explica el motivo (obligatorio, no vacío). No cambia la fecha;
 * solo notifica al Creador.
 */
export const deadlineExtensionSchema = z.object({
  requestedDate: z.string().min(1, 'Selecciona una fecha propuesta'),
  reason: z.string().trim().min(1, 'Explica el motivo de la prórroga'),
});

export type DeadlineExtensionValues = z.infer<typeof deadlineExtensionSchema>;
