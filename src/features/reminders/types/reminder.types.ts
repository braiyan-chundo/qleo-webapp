/**
 * Tipos del feature **Recordatorios** (HU-0202). Espejo literal del contrato §3.74
 * (`docs/architecture/integracion/06-recordatorios.md`), con los nombres de los DTO de la API.
 *
 * Fechas `YYYY-MM-DD` y horas `HH:mm` viajan como **texto civil de Bogotá**; los instantes de las
 * respuestas (`nextFireAt`, `occurrences[].at`) son ISO UTC y se pintan con `lib/bogota-time.ts`.
 */

export type ReminderKind = 'ONCE' | 'DATES' | 'WEEKLY' | 'DAILY' | 'INTERVAL';
export type SlotResult = 'PENDING' | 'FIRED' | 'MISSED';
export type SkipReason = 'NON_WORKING_DAY' | 'OUTSIDE_WORKING_HOURS';
export type ReminderStatus = 'ACTIVE' | 'PAUSED' | 'FINISHED';
export type ReminderBlockedReason = 'TASK_COMPLETED' | 'TASK_DISCARDED' | 'NO_TASK_ACCESS';

/** Par fecha+hora de `ONCE` (exactamente 1) y `DATES` (1..50, sin repetir). */
export interface ReminderSlotInput {
  date: string;
  time: string;
}

/** Par guardado: trae además su resultado. */
export interface ReminderSlot extends ReminderSlotInput {
  result: SlotResult;
}

/** Programación de entrada. Los campos que no aplican al `kind` se ignoran y no se guardan. */
export interface ReminderScheduleDto {
  kind: ReminderKind;
  slots?: ReminderSlotInput[];
  /** 0=dom … 6=sáb, 1..7 sin repetir. `WEEKLY` e `INTERVAL`. */
  weekdays?: number[];
  /** `WEEKLY` y `DAILY`. */
  time?: string;
  /** Entero 1..12. `INTERVAL`. */
  everyHours?: number;
  startTime?: string;
  /** Posterior a `startTime`, mismo día, inclusivo. */
  endTime?: string;
}

/** Programación tal como la devuelve la API: solo los campos de su `kind`. */
export interface ReminderScheduleResponse extends Omit<ReminderScheduleDto, 'slots'> {
  slots?: ReminderSlot[];
}

export interface CreateReminderDto {
  message: string;
  taskId?: string | null;
  schedule: ReminderScheduleDto;
  soundOnNonWorkingDays?: boolean;
  soundOutsideWorkingHours?: boolean;
}

/** Omitido = no cambia; `taskId: null` desasocia; `schedule` se reemplaza entero. */
export type UpdateReminderDto = Partial<CreateReminderDto>;

export interface PreviewReminderDto {
  schedule: ReminderScheduleDto;
  soundOnNonWorkingDays?: boolean;
  soundOutsideWorkingHours?: boolean;
}

/** Tarea asociada. `null` sin tarea **o sin acceso** (el servidor no revela el título). */
export interface ReminderTaskRef {
  id: string;
  title: string;
  projectId: string;
}

export interface ReminderResponseDto {
  id: string;
  message: string;
  taskId: string | null;
  task: ReminderTaskRef | null;
  schedule: ReminderScheduleResponse;
  soundOnNonWorkingDays: boolean;
  soundOutsideWorkingHours: boolean;
  status: ReminderStatus;
  /** Derivado al leer; `null` si `FINISHED`. */
  blockedReason: ReminderBlockedReason | null;
  /** ISO UTC del próximo aviso que sí sonaría; `null` si en pausa, cumplido, bloqueado o sin aviso en 366 días. */
  nextFireAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReminderOccurrenceDto {
  at: string;
  skipped: SkipReason | null;
}

/** `ONCE`/`DATES`: sus pares futuros; recurrentes: 14 días, máx. 60. */
export interface ReminderPreviewDto {
  occurrences: ReminderOccurrenceDto[];
  truncated: boolean;
}

export interface ReminderTaskOptionDto {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  completed: boolean;
}
