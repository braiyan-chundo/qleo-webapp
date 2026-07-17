import * as z from 'zod';

/**
 * Esquema del formulario de tarea (crear/editar). `title` es obligatorio; `columnId` es
 * opcional (si se omite el backend usa la columna default del proyecto, el Backlog).
 */
export const taskFormSchema = z.object({
  title: z.string().trim().min(1, 'El título es obligatorio'),
  description: z.string().trim().optional(),
  columnId: z.string().optional(),
  /** Categoría corta opcional (p.ej. "VUELOS"). */
  label: z.string().trim().optional(),
  /** Fecha de inicio opcional (valor de `<input type="date">`, `YYYY-MM-DD`). */
  startDate: z.string().optional(),
  /**
   * (P1) Fecha límite opcional elegida en el **alta** (valor `<input type="date">`,
   * `YYYY-MM-DD`). Solo se usa al crear: en edición el deadline se gestiona con la
   * `DeadlineSection` del detalle (incl. bloqueo, prórroga y calendario laboral).
   */
  dueDate: z.string().optional(),
  /** (P1) Bloquear la edición del deadline por no-Creadores desde el alta. */
  deadlineLocked: z.boolean().optional(),
  /**
   * (QL-123) Responsable (ASSIGNEE) elegido en el **alta**; `''` = sin responsable.
   * Solo se usa al crear: en edición los roles se gestionan con el `RoleManager` del detalle.
   */
  assigneeId: z.string().optional(),
  /** (QL-123) Colaboradores (COLLABORATOR) elegidos en el **alta**. Vacío = ninguno. */
  collaboratorIds: z.array(z.string()).optional(),
  /**
   * (QL-138) Observadores (OBSERVER, solo lectura) elegidos en el **alta**. Vacío = ninguno.
   * Solo se usa al crear: en edición los roles se gestionan con el `RoleManager` del detalle.
   */
  observerIds: z.array(z.string()).optional(),
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
