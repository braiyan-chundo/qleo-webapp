import * as z from 'zod';

/** Tope de caracteres del motivo/comentario del fin abierto (mismo que el backend, QL-197). */
export const OPEN_ENDED_REASON_MAX = 500;

/**
 * Esquema del formulario de tarea (crear/editar). `title` es obligatorio; `columnId` es
 * opcional (si se omite el backend usa la columna default del proyecto, el Backlog).
 *
 * ⚠️ Las **fechas** no se validan aquí: su obligatoriedad depende del modo (alta vs. edición) y
 * de lo que la tarea ya tenía, así que vive en {@link buildTaskFormSchema}. Este objeto es la
 * forma base, y {@link taskFormSchema} su variante permisiva para quien solo necesite el tipo.
 */
const taskFormShape = z.object({
  title: z.string().trim().min(1, 'El título es obligatorio'),
  description: z.string().trim().optional(),
  columnId: z.string().optional(),
  /**
   * (QL-146, §3.38) Id de la etiqueta elegida del catálogo del proyecto, o `''` = sin etiqueta.
   * Una sola por ahora; se envía como `labelIds` (`[]` o `[id]`).
   */
  labelId: z.string().optional(),
  /**
   * Fecha de inicio (valor de `<input type="date">`, `YYYY-MM-DD`).
   *
   * (QL-197) **Obligatoria en el alta**, sin excepción posible. En la edición solo lo es si la
   * tarea ya la tenía: la regla rige hacia adelante y una tarea antigua sin fecha se sigue
   * editando con normalidad. Lo decide {@link buildTaskFormSchema}.
   */
  startDate: z.string().optional(),
  /**
   * (P1) Fecha límite elegida en el **alta** (valor `<input type="date">`, `YYYY-MM-DD`) y en la
   * edición completa del ADMIN. En la edición reducida del CREATOR el deadline se gestiona con
   * la `DeadlineSection` del detalle (incl. bloqueo, prórroga y calendario laboral).
   *
   * (QL-197) **Obligatoria salvo** que se marque {@link openEnded}. Las dos son excluyentes.
   */
  dueDate: z.string().optional(),
  /**
   * (QL-166) Hora del deadline (valor `<input type="time">`, `HH:mm`). Opcional: si se elige
   * fecha sin hora, se serializa a las 18:00 (fin de jornada). Solo aplica con `dueDate`.
   */
  dueTime: z.string().optional(),
  /** (P1) Bloquear la edición del deadline por no-Creadores desde el alta. */
  deadlineLocked: z.boolean().optional(),
  /**
   * (QL-197, §3.69) Check **"Sin fecha de finalización"**: pide a Dirección autorización para
   * dejar la tarea sin `dueDate`. Solo existe en el **alta** (`PATCH /tasks/:id` no acepta
   * `openEndedRequest`), y marcarlo **excluye** poner fecha límite: mandar las dos cosas es un
   * 400 `OPEN_ENDED_REQUEST_NOT_APPLICABLE`.
   */
  openEnded: z.boolean().optional(),
  /**
   * (QL-197) Directivo al que se le pide la autorización. Va **junto** al motivo: el backend
   * recibe un objeto `openEndedRequest: { managerId, reason }`, así que no se puede mandar media
   * solicitud. Debe ser un usuario ACTIVO de Dirección o el alta falla con 400
   * `OPEN_ENDED_MANAGER_INVALID` y la tarea **no se crea**.
   */
  openEndedManagerId: z.string().optional(),
  /** (QL-197) Motivo de la solicitud. Obligatorio si se marca {@link openEnded}. */
  openEndedReason: z.string().optional(),
  /**
   * (QL-123) Responsable (ASSIGNEE) elegido en el **alta**.
   *
   * (QL-192) **Nunca hay tarea sin Responsable**: el formulario lo preselecciona con el usuario
   * actual (que puede cambiarlo por otra persona) y, si aun así llegara vacío, el backend pone
   * al creador. `''` es solo el hueco transitorio mientras cargan los miembros — no un estado
   * elegible—, y por eso el campo sigue siendo `optional()` sin validación extra.
   * Un mismo `userId` puede ser CREATOR y ASSIGNEE a la vez: aquí no hay nada que deduplicar,
   * porque el creador no se envía en `collaboratorIds`/`observerIds`.
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

export type TaskFormValues = z.infer<typeof taskFormShape>;

/**
 * (QL-197, §3.69) Qué exige el formulario en **este** uso concreto. La obligatoriedad de las
 * fechas no es una constante del esquema porque **rige hacia adelante**: al crear siempre se
 * piden, pero al editar solo se exige lo que la tarea ya tenía — de las 64 tareas del clon de
 * producción, 60 no tienen `dueDate` y 17 no tienen `startDate`, y bloquearles la edición por
 * una fecha que nadie les puso habría congelado casi todo el histórico.
 */
export interface TaskFormRules {
  /** La fecha de inicio no puede quedar vacía (alta siempre; edición si ya la tenía). */
  requireStartDate: boolean;
  /** La fecha de fin no puede quedar vacía (alta siempre; edición si ya la tenía). */
  requireDueDate: boolean;
  /**
   * ¿Se ofrece el check "Sin fecha de finalización"? **Solo en el alta**: `PATCH /tasks/:id` no
   * acepta `openEndedRequest`, así que en edición la única salida de una tarea bloqueada es
   * ponerle fecha (lo que además cancela la solicitud en el backend).
   */
  allowOpenEnded: boolean;
}

/**
 * Construye el esquema del formulario con las reglas de fecha de {@link TaskFormRules}.
 *
 * Las tres validaciones que añade sobre la forma base espejan **exactamente** los 400 del
 * backend, para que el usuario los vea antes de enviar y no como un toast tras el fallo:
 * `TASK_START_DATE_REQUIRED`, `TASK_DUE_DATE_REQUIRED` y `OPEN_ENDED_REQUEST_NOT_APPLICABLE`
 * (más los dos campos de la solicitud, que van **juntos o ninguno**).
 */
export function buildTaskFormSchema(rules: TaskFormRules) {
  return taskFormShape.superRefine((values, ctx) => {
    const startDate = values.startDate?.trim() ?? '';
    const dueDate = values.dueDate?.trim() ?? '';
    // El check solo cuenta donde se ofrece: si un valor viejo quedara en el estado del
    // formulario en modo edición, se ignora en vez de habilitar una vía que la API no acepta.
    const openEnded = rules.allowOpenEnded && values.openEnded === true;

    if (rules.requireStartDate && !startDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['startDate'],
        message: 'La fecha de inicio es obligatoria',
      });
    }

    if (openEnded && dueDate) {
      // La UI ya limpia y deshabilita la fecha al marcar el check; esto es la red de abajo.
      ctx.addIssue({
        code: 'custom',
        path: ['dueDate'],
        message: 'Quita la fecha de fin o desmarca «Sin fecha de finalización»',
      });
    }

    if (rules.requireDueDate && !dueDate && !openEnded) {
      ctx.addIssue({
        code: 'custom',
        path: ['dueDate'],
        message: rules.allowOpenEnded
          ? 'Pon una fecha de fin o marca «Sin fecha de finalización»'
          : 'La fecha de fin es obligatoria',
      });
    }

    if (openEnded) {
      if (!values.openEndedManagerId?.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['openEndedManagerId'],
          message: 'Elige a quién de Dirección le pides la autorización',
        });
      }
      const reason = values.openEndedReason?.trim() ?? '';
      if (!reason) {
        ctx.addIssue({
          code: 'custom',
          path: ['openEndedReason'],
          message: 'Explica por qué la tarea no puede tener fecha de fin',
        });
      } else if (reason.length > OPEN_ENDED_REASON_MAX) {
        ctx.addIssue({
          code: 'custom',
          path: ['openEndedReason'],
          message: `Máximo ${OPEN_ENDED_REASON_MAX} caracteres`,
        });
      }
    }
  });
}

/**
 * Variante permisiva (sin ninguna fecha obligatoria). Es la que usa cualquier consumidor que
 * solo necesite la forma; el formulario real construye la suya con {@link buildTaskFormSchema}.
 */
export const taskFormSchema = buildTaskFormSchema({
  requireStartDate: false,
  requireDueDate: false,
  allowOpenEnded: false,
});

/**
 * Esquema del formulario de "Solicitar prórroga" (QL-09, §3.7). Un no-Creador propone una
 * nueva fecha (obligatoria) y explica el motivo (obligatorio, no vacío). No cambia la fecha;
 * solo notifica al Creador.
 */
export const deadlineExtensionSchema = z.object({
  requestedDate: z.string().min(1, 'Selecciona una fecha propuesta'),
  /**
   * (QL-166) Hora propuesta (`<input type="time">`, `HH:mm`). Opcional: vacía → 18:00 al
   * serializar. Se combina con `requestedDate` en un ISO completo antes de enviar.
   */
  requestedTime: z.string().optional(),
  reason: z.string().trim().min(1, 'Explica el motivo de la prórroga'),
});

export type DeadlineExtensionValues = z.infer<typeof deadlineExtensionSchema>;

/** Tope de caracteres del comentario de validación/rechazo (mismo que el backend). */
export const REVIEW_COMMENT_MAX = 2000;

/**
 * (QL-171/QL-172) Esquema del diálogo de **rechazo** de la revisión. El motivo es
 * **obligatorio** (el backend también lo exige) y la nueva fecha límite es opcional y **solo se
 * ofrece al CREATOR**: si un no-creador enviara `newDueDate`, el backend responde 403
 * `DEADLINE_EXTENSION_CREATOR_ONLY` y ni siquiera aplicaría el rechazo.
 */
export const rejectReviewSchema = z.object({
  comment: z
    .string()
    .trim()
    .min(1, 'Explica por qué rechazas la revisión')
    .max(REVIEW_COMMENT_MAX, `Máximo ${REVIEW_COMMENT_MAX} caracteres`),
  /** Valor de `<input type="date">` (`YYYY-MM-DD`); vacío = no cambiar la fecha. */
  newDueDate: z.string().optional(),
  /** (QL-166) Hora del nuevo deadline (`HH:mm`); vacía → 18:00 al serializar. */
  newDueTime: z.string().optional(),
});

export type RejectReviewValues = z.infer<typeof rejectReviewSchema>;

/**
 * (QL-171) Esquema del diálogo de **validación**: el comentario es **opcional** (queda en
 * `validationComment`), solo acotado en longitud.
 */
export const validateReviewSchema = z.object({
  comment: z
    .string()
    .trim()
    .max(REVIEW_COMMENT_MAX, `Máximo ${REVIEW_COMMENT_MAX} caracteres`)
    .optional(),
});

export type ValidateReviewValues = z.infer<typeof validateReviewSchema>;

/**
 * (QL-197, §3.69) Diálogo con el que Dirección **autoriza** el fin abierto: comentario
 * **opcional** (mismo criterio que el visto bueno de QL-171), solo acotado en longitud.
 */
export const approveOpenEndedSchema = z.object({
  comment: z
    .string()
    .trim()
    .max(OPEN_ENDED_REASON_MAX, `Máximo ${OPEN_ENDED_REASON_MAX} caracteres`)
    .optional(),
});

export type ApproveOpenEndedValues = z.infer<typeof approveOpenEndedSchema>;

/**
 * (QL-197, §3.69) Diálogo con el que Dirección **deniega** el fin abierto: el motivo es
 * **obligatorio** (el backend también lo exige). Denegar sin decir por qué deja la tarea
 * bloqueada y al Creador sin saber qué corregir.
 */
export const rejectOpenEndedSchema = z.object({
  comment: z
    .string()
    .trim()
    .min(1, 'Explica por qué no autorizas dejar la fecha de fin abierta')
    .max(OPEN_ENDED_REASON_MAX, `Máximo ${OPEN_ENDED_REASON_MAX} caracteres`),
});

export type RejectOpenEndedValues = z.infer<typeof rejectOpenEndedSchema>;

/**
 * (QL-201, §3.73 §5) Esquema del diálogo **Duplicar tarea**.
 *
 * Las dos fechas son **obligatorias en el formulario** aunque el endpoint las acepte opcionales, y
 * es una decisión deliberada. La copia es una tarea NUEVA y tiene que cumplir QL-197 por sí misma:
 * si la original no tiene `startDate` (17 tareas antiguas en producción) o no tiene `dueDate` (60
 * de 64, y también las que tienen el fin abierto **autorizado**, porque la autorización no se
 * hereda), el backend responde 400. El diálogo ya tiene la tarea original cargada, así que **sabe
 * de antemano** qué le falta: se pre-rellenan con las de la original cuando existen y se piden
 * cuando no, en vez de dejar que el usuario descubra la regla con un error al enviar.
 *
 * Exigirlas siempre —en vez de solo cuando falten— evita además la trampa del campo vacío: en el
 * endpoint, omitir una fecha significa "hereda la de la original", no "sin fecha", así que un
 * usuario que borrase el campo esperando dejarla en blanco obtendría justo lo contrario.
 */
export const duplicateTaskSchema = z.object({
  /** Proyecto DESTINO. Único campo que el endpoint exige de verdad. */
  projectId: z.string().trim().min(1, 'Elige el proyecto de destino'),
  /** Columna del destino; vacío = la columna por defecto de ese tablero. */
  columnId: z.string().optional(),
  /** Título de la copia. Se pre-rellena con el de la original, **sin prefijos** (§3.73 §1). */
  title: z
    .string()
    .trim()
    .min(1, 'El título es obligatorio')
    .max(200, 'Máximo 200 caracteres'),
  /** Valor de `<input type="date">` (`YYYY-MM-DD`). */
  startDate: z.string().trim().min(1, 'La fecha de inicio es obligatoria'),
  /** Valor de `<input type="date">` (`YYYY-MM-DD`). */
  dueDate: z.string().trim().min(1, 'La fecha de fin es obligatoria'),
  /** (QL-166) Hora del deadline (`HH:mm`); vacía → 18:00 al serializar. */
  dueTime: z.string().optional(),
});

export type DuplicateTaskValues = z.infer<typeof duplicateTaskSchema>;
