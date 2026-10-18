import * as z from 'zod';

import type {
  CreateReminderDto,
  PreviewReminderDto,
  ReminderKind,
  ReminderResponseDto,
  ReminderScheduleDto,
  ReminderSlot,
  UpdateReminderDto,
} from '../types/reminder.types';
import { addCivilDays, bogotaToday, isCivilPast } from '../lib/bogota-time';
import { MAX_DAYS_AHEAD, MAX_EVERY_HOURS, MESSAGE_MAX_LENGTH } from '../lib/reminder-display';

/**
 * Formulario de **recordatorio** (HU-0202, §3.74). Fechas y horas se guardan como el texto civil
 * de Bogotá que se va a enviar (`'YYYY-MM-DD'`, `'HH:mm'`); nunca un `Date` ni `toISOString()`.
 *
 * Cada tipo guarda sus propios campos, así cambiar de tipo y volver no pierde lo escrito. Solo se
 * envían los del tipo elegido.
 *
 * Lo que **no** se valida aquí, a propósito: el calendario laboral (lo dice `preview`, y solo
 * advierte), el tope de 100 (`REMINDER_LIMIT_REACHED`) y el acceso a la tarea
 * (`REMINDER_TASK_NOT_FOUND`). Sí lo que es puro formulario y el servidor también rechaza
 * (D-5…D-9, AC-03…AC-07).
 */

export const MESSAGES = {
  messageRequired: 'Escribe el mensaje del recordatorio.',
  messageTooLong: 'El mensaje admite hasta 200 caracteres. Acórtalo un poco.',
  dateRequired: 'Elige la fecha del aviso.',
  timeRequired: 'Elige la hora del aviso; no tiene una por defecto.',
  slotDateRequired: 'Elige la fecha.',
  slotTimeRequired: 'Elige la hora de esta fecha; no tiene una por defecto.',
  slotsRequired: 'Añade al menos una fecha con su hora.',
  inPast: 'Esa fecha y hora ya pasaron. Elige un momento posterior a ahora.',
  tooFar: 'Elige una fecha dentro del próximo año.',
  duplicate: 'Esa fecha y hora ya está en la lista.',
  weekdaysRequired: 'Marca al menos un día de la semana.',
  everyHours: 'Elige un número de horas entre 1 y 12.',
  rangeTimesRequired: 'Elige las horas «Desde» y «Hasta».',
  rangeOrder: 'La hora «Hasta» debe ser posterior a «Desde», dentro del mismo día.',
} as const;

const slotSchema = z.object({ date: z.string(), time: z.string() });

const baseSchema = z.object({
  message: z.string(),
  taskId: z.string().nullable(),
  kind: z.enum(['ONCE', 'DATES', 'WEEKLY', 'DAILY', 'INTERVAL']),
  onceDate: z.string(),
  onceTime: z.string(),
  dailyTime: z.string(),
  weeklyDays: z.array(z.number()),
  weeklyTime: z.string(),
  /** Pares de «Fechas sueltas» que se pueden editar (pendientes o nuevos). */
  slots: z.array(slotSchema),
  everyHours: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  intervalDays: z.array(z.number()),
  soundOnNonWorkingDays: z.boolean(),
  soundOutsideWorkingHours: z.boolean(),
});

export type ReminderFormValues = z.infer<typeof baseSchema>;
export type ReminderFormSlot = z.infer<typeof slotSchema>;

/** Contexto de edición: lo guardado que el formulario no muestra como editable. */
export interface ReminderFormContext {
  /** Pares de «Fechas sueltas» que ya sonaron o no sonaron: solo lectura, se reenvían tal cual. */
  resolvedSlots: ReminderSlot[];
  /** Claves `fecha|hora` de todos los pares guardados: un par idéntico no es «nuevo» (§3.74 §4). */
  storedPairs: ReadonlySet<string>;
}

export const EMPTY_CONTEXT: ReminderFormContext = { resolvedSlots: [], storedPairs: new Set() };

export const pairKey = (date: string, time: string) => `${date}|${time}`;

const isBlank = (slot: ReminderFormSlot) => !slot.date && !slot.time;

/**
 * Filas de fechas sueltas que cuentan: una fila del todo vacía se ignora si hay otra fila o un par
 * ya resuelto (así «Añadir fecha» sin rellenar no bloquea guardar).
 */
export function effectiveSlots(values: Pick<ReminderFormValues, 'slots'>, ctx: ReminderFormContext): ReminderFormSlot[] {
  const filled = values.slots.filter((slot) => !isBlank(slot));
  if (filled.length > 0 || ctx.resolvedSlots.length > 0) return filled;
  return values.slots.slice(0, 1);
}

function parseEveryHours(value: string): number | null {
  if (!/^\d{1,2}$/.test(value.trim())) return null;
  const n = Number(value.trim());
  return n >= 1 && n <= MAX_EVERY_HOURS ? n : null;
}

/** Último día elegible para un par nuevo (B-1). */
export function lastEligibleDay(now: Date = new Date()): string {
  return addCivilDays(bogotaToday(now), MAX_DAYS_AHEAD);
}

export function buildReminderFormSchema(ctx: ReminderFormContext = EMPTY_CONTEXT) {
  return baseSchema.superRefine((values, issue) => {
    const now = new Date();
    const maxDay = lastEligibleDay(now);
    const add = (path: (string | number)[], message: string) =>
      issue.addIssue({ code: 'custom', path, message });
    const isNew = (date: string, time: string) => !ctx.storedPairs.has(pairKey(date, time));

    const message = values.message.trim();
    if (!message) add(['message'], MESSAGES.messageRequired);
    else if (message.length > MESSAGE_MAX_LENGTH) add(['message'], MESSAGES.messageTooLong);

    switch (values.kind) {
      case 'ONCE': {
        if (!values.onceDate) add(['onceDate'], MESSAGES.dateRequired);
        if (!values.onceTime) add(['onceTime'], MESSAGES.timeRequired);
        if (values.onceDate && values.onceTime && isNew(values.onceDate, values.onceTime)) {
          if (isCivilPast(values.onceDate, values.onceTime, now)) add(['onceTime'], MESSAGES.inPast);
          else if (values.onceDate > maxDay) add(['onceDate'], MESSAGES.tooFar);
        }
        break;
      }
      case 'DAILY':
        if (!values.dailyTime) add(['dailyTime'], MESSAGES.timeRequired);
        break;
      case 'WEEKLY':
        if (values.weeklyDays.length === 0) add(['weeklyDays'], MESSAGES.weekdaysRequired);
        if (!values.weeklyTime) add(['weeklyTime'], MESSAGES.timeRequired);
        break;
      case 'DATES': {
        const slots = effectiveSlots(values, ctx);
        if (slots.length === 0 && ctx.resolvedSlots.length === 0) {
          add(['slots'], MESSAGES.slotsRequired);
          break;
        }
        const seen = new Set(ctx.resolvedSlots.map((s) => pairKey(s.date, s.time)));
        values.slots.forEach((slot, index) => {
          if (!slots.includes(slot)) return;
          if (!slot.date) add(['slots', index, 'date'], MESSAGES.slotDateRequired);
          if (!slot.time) add(['slots', index, 'time'], MESSAGES.slotTimeRequired);
          if (!slot.date || !slot.time) return;
          const key = pairKey(slot.date, slot.time);
          if (seen.has(key)) {
            add(['slots', index, 'time'], MESSAGES.duplicate);
            return;
          }
          seen.add(key);
          if (isNew(slot.date, slot.time)) {
            if (isCivilPast(slot.date, slot.time, now)) add(['slots', index, 'time'], MESSAGES.inPast);
            else if (slot.date > maxDay) add(['slots', index, 'date'], MESSAGES.tooFar);
          }
        });
        break;
      }
      case 'INTERVAL': {
        if (parseEveryHours(values.everyHours) === null) add(['everyHours'], MESSAGES.everyHours);
        if (!values.startTime || !values.endTime) add(['startTime'], MESSAGES.rangeTimesRequired);
        else if (values.endTime <= values.startTime) add(['endTime'], MESSAGES.rangeOrder);
        if (values.intervalDays.length === 0) add(['intervalDays'], MESSAGES.weekdaysRequired);
        break;
      }
    }
  });
}

/* ------------------------------------------------------------------------------------------ */
/* Valores ↔ contrato                                                                          */
/* ------------------------------------------------------------------------------------------ */

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export function emptyReminderValues(taskId: string | null = null): ReminderFormValues {
  return {
    message: '',
    taskId,
    kind: 'ONCE',
    onceDate: '',
    onceTime: '',
    dailyTime: '',
    weeklyDays: [],
    weeklyTime: '',
    slots: [{ date: '', time: '' }],
    everyHours: '',
    startTime: '',
    endTime: '',
    // (maqueta) «Cada N horas» nuevo arranca con todos los días marcados (D-6).
    intervalDays: [...ALL_DAYS],
    soundOnNonWorkingDays: false,
    soundOutsideWorkingHours: false,
  };
}

/** Valores y contexto de un recordatorio guardado. */
export function reminderToForm(reminder: ReminderResponseDto): {
  values: ReminderFormValues;
  context: ReminderFormContext;
} {
  const values = emptyReminderValues(reminder.taskId);
  const { schedule } = reminder;
  const slots = schedule.slots ?? [];
  values.message = reminder.message;
  values.kind = schedule.kind;
  values.soundOnNonWorkingDays = reminder.soundOnNonWorkingDays;
  values.soundOutsideWorkingHours = reminder.soundOutsideWorkingHours;

  let resolvedSlots: ReminderSlot[] = [];
  switch (schedule.kind) {
    case 'ONCE':
      values.onceDate = slots[0]?.date ?? '';
      values.onceTime = slots[0]?.time ?? '';
      break;
    case 'DATES':
      resolvedSlots = slots.filter((slot) => slot.result !== 'PENDING');
      values.slots = slots
        .filter((slot) => slot.result === 'PENDING')
        .map(({ date, time }) => ({ date, time }));
      break;
    case 'DAILY':
      values.dailyTime = schedule.time ?? '';
      break;
    case 'WEEKLY':
      values.weeklyDays = [...(schedule.weekdays ?? [])];
      values.weeklyTime = schedule.time ?? '';
      break;
    case 'INTERVAL':
      values.everyHours = schedule.everyHours != null ? String(schedule.everyHours) : '';
      values.startTime = schedule.startTime ?? '';
      values.endTime = schedule.endTime ?? '';
      values.intervalDays = [...(schedule.weekdays ?? [])];
      break;
  }

  return {
    values,
    context: { resolvedSlots, storedPairs: new Set(slots.map((s) => pairKey(s.date, s.time))) },
  };
}

const sortPairs = <T extends { date: string; time: string }>(slots: readonly T[]) =>
  [...slots].sort((a, b) => pairKey(a.date, a.time).localeCompare(pairKey(b.date, b.time)));

const sortDays = (days: readonly number[]) => [...new Set(days)].sort((a, b) => a - b);

/** Programación del contrato con **solo** los campos del tipo (los ya resueltos se reenvían). */
export function toScheduleDto(values: ReminderFormValues, ctx: ReminderFormContext): ReminderScheduleDto {
  switch (values.kind) {
    case 'ONCE':
      return { kind: 'ONCE', slots: [{ date: values.onceDate, time: values.onceTime }] };
    case 'DATES':
      return {
        kind: 'DATES',
        slots: sortPairs([
          ...ctx.resolvedSlots.map(({ date, time }) => ({ date, time })),
          ...effectiveSlots(values, ctx),
        ]),
      };
    case 'DAILY':
      return { kind: 'DAILY', time: values.dailyTime };
    case 'WEEKLY':
      return { kind: 'WEEKLY', weekdays: sortDays(values.weeklyDays), time: values.weeklyTime };
    case 'INTERVAL':
      return {
        kind: 'INTERVAL',
        everyHours: Number(values.everyHours.trim()),
        startTime: values.startTime,
        endTime: values.endTime,
        weekdays: sortDays(values.intervalDays),
      };
  }
}

/** Forma canónica de una programación, para saber si cambió (y no mandarla si no, §3.74 §4). */
export function scheduleKey(schedule: ReminderScheduleDto): string {
  const kind: ReminderKind = schedule.kind;
  return JSON.stringify({
    kind,
    slots:
      kind === 'ONCE' || kind === 'DATES'
        ? sortPairs(schedule.slots ?? []).map(({ date, time }) => pairKey(date, time))
        : null,
    weekdays: kind === 'WEEKLY' || kind === 'INTERVAL' ? sortDays(schedule.weekdays ?? []) : null,
    time: kind === 'WEEKLY' || kind === 'DAILY' ? (schedule.time ?? null) : null,
    everyHours: kind === 'INTERVAL' ? (schedule.everyHours ?? null) : null,
    startTime: kind === 'INTERVAL' ? (schedule.startTime ?? null) : null,
    endTime: kind === 'INTERVAL' ? (schedule.endTime ?? null) : null,
  });
}

export function toCreateDto(values: ReminderFormValues, ctx: ReminderFormContext): CreateReminderDto {
  return {
    message: values.message.trim(),
    ...(values.taskId ? { taskId: values.taskId } : {}),
    schedule: toScheduleDto(values, ctx),
    soundOnNonWorkingDays: values.soundOnNonWorkingDays,
    soundOutsideWorkingHours: values.soundOutsideWorkingHours,
  };
}

/**
 * Solo lo que cambió. `schedule` no viaja si la programación es la misma: así editar el mensaje,
 * la tarea o una casilla de un recordatorio en pausa con un par ya vencido no choca con
 * `REMINDER_IN_PAST` (§3.74 §4, pregunta abierta a la persona usuaria).
 */
export function toUpdateDto(
  values: ReminderFormValues,
  ctx: ReminderFormContext,
  original: ReminderResponseDto,
): UpdateReminderDto {
  const dto: UpdateReminderDto = {};
  const message = values.message.trim();
  if (message !== original.message) dto.message = message;
  if ((values.taskId ?? null) !== (original.taskId ?? null)) dto.taskId = values.taskId ?? null;
  const schedule = toScheduleDto(values, ctx);
  if (scheduleKey(schedule) !== scheduleKey(original.schedule)) dto.schedule = schedule;
  if (values.soundOnNonWorkingDays !== original.soundOnNonWorkingDays) {
    dto.soundOnNonWorkingDays = values.soundOnNonWorkingDays;
  }
  if (values.soundOutsideWorkingHours !== original.soundOutsideWorkingHours) {
    dto.soundOutsideWorkingHours = values.soundOutsideWorkingHours;
  }
  return dto;
}

/**
 * Cuerpo de la vista previa, o `null` si la programación aún no está completa (o no es válida):
 * sin eso el servidor respondería 400 y no hay nada que enseñar. En `ONCE`/`DATES` solo entran
 * los pares futuros dentro del año (el servidor solo muestra esos).
 */
export function toPreviewBody(values: ReminderFormValues, ctx: ReminderFormContext): PreviewReminderDto | null {
  const now = new Date();
  const maxDay = lastEligibleDay(now);
  const usable = (date: string, time: string) =>
    !!date && !!time && !isCivilPast(date, time, now) && date <= maxDay;
  let schedule: ReminderScheduleDto | null = null;

  switch (values.kind) {
    case 'ONCE':
      if (usable(values.onceDate, values.onceTime)) {
        schedule = { kind: 'ONCE', slots: [{ date: values.onceDate, time: values.onceTime }] };
      }
      break;
    case 'DATES': {
      const seen = new Set<string>();
      const slots = effectiveSlots(values, ctx)
        .filter((slot) => usable(slot.date, slot.time))
        .filter((slot) => {
          const key = pairKey(slot.date, slot.time);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      if (slots.length > 0) schedule = { kind: 'DATES', slots: sortPairs(slots) };
      break;
    }
    case 'DAILY':
      if (values.dailyTime) schedule = { kind: 'DAILY', time: values.dailyTime };
      break;
    case 'WEEKLY':
      if (values.weeklyTime && values.weeklyDays.length > 0) {
        schedule = { kind: 'WEEKLY', weekdays: sortDays(values.weeklyDays), time: values.weeklyTime };
      }
      break;
    case 'INTERVAL': {
      const every = parseEveryHours(values.everyHours);
      if (
        every !== null &&
        values.startTime &&
        values.endTime &&
        values.endTime > values.startTime &&
        values.intervalDays.length > 0
      ) {
        schedule = {
          kind: 'INTERVAL',
          everyHours: every,
          startTime: values.startTime,
          endTime: values.endTime,
          weekdays: sortDays(values.intervalDays),
        };
      }
      break;
    }
  }

  if (!schedule) return null;
  return {
    schedule,
    soundOnNonWorkingDays: values.soundOnNonWorkingDays,
    soundOutsideWorkingHours: values.soundOutsideWorkingHours,
  };
}
