import { describe, expect, it } from 'vitest';

import type { ReminderResponseDto } from '../types/reminder.types';
import {
  buildReminderFormSchema,
  emptyReminderValues,
  reminderToForm,
  toCreateDto,
  toPreviewBody,
  toUpdateDto,
  EMPTY_CONTEXT,
  MESSAGES,
} from './reminder-form.schema';

function issues(values: ReturnType<typeof emptyReminderValues>) {
  const result = buildReminderFormSchema().safeParse(values);
  return result.success ? {} : Object.fromEntries(result.error.issues.map((i) => [i.path.join('.'), i.message]));
}

const stored: ReminderResponseDto = {
  id: 'r1',
  message: 'Revisar correos',
  taskId: null,
  task: null,
  schedule: {
    kind: 'DATES',
    slots: [
      { date: '2020-01-10', time: '09:00', result: 'FIRED' },
      // Par pendiente ya vencido (recordatorio en pausa): no debe viajar si no se toca.
      { date: '2020-02-10', time: '09:00', result: 'PENDING' },
    ],
  },
  soundOnNonWorkingDays: false,
  soundOutsideWorkingHours: false,
  status: 'PAUSED',
  blockedReason: null,
  nextFireAt: null,
  createdAt: '2020-01-01T00:00:00Z',
  updatedAt: '2020-01-01T00:00:00Z',
};

describe('validación del formulario', () => {
  it('mensaje obligatorio, sin solo espacios y hasta 200 (AC-07)', () => {
    const values = { ...emptyReminderValues(), kind: 'DAILY' as const, dailyTime: '08:15' };
    expect(issues({ ...values, message: '   ' }).message).toBe(MESSAGES.messageRequired);
    expect(issues({ ...values, message: 'x'.repeat(201) }).message).toBe(MESSAGES.messageTooLong);
    expect(issues({ ...values, message: 'Revisar' })).toEqual({});
  });

  it('la hora no tiene valor por defecto y un «una vez» no va al pasado (AC-02, AC-07)', () => {
    const base = { ...emptyReminderValues(), message: 'Llamar', onceDate: '2099-01-01' };
    expect(issues(base).onceTime).toBe(MESSAGES.timeRequired);
    expect(issues({ ...base, onceDate: '2020-01-01', onceTime: '10:00' }).onceTime).toBe(MESSAGES.inPast);
  });

  it('días de la semana, cada N horas y franja (AC-03, AC-06)', () => {
    const weekly = { ...emptyReminderValues(), message: 'x', kind: 'WEEKLY' as const, weeklyTime: '09:30' };
    expect(issues(weekly).weeklyDays).toBe(MESSAGES.weekdaysRequired);
    const interval = {
      ...emptyReminderValues(),
      message: 'x',
      kind: 'INTERVAL' as const,
      everyHours: '13',
      startTime: '18:00',
      endTime: '08:00',
    };
    expect(issues(interval).everyHours).toBe(MESSAGES.everyHours);
    expect(issues(interval).endTime).toBe(MESSAGES.rangeOrder);
    expect(issues({ ...interval, everyHours: '0' }).everyHours).toBe(MESSAGES.everyHours);
  });

  it('fechas sueltas: cada una con su hora y sin repetir (AC-04)', () => {
    const values = {
      ...emptyReminderValues(),
      message: 'x',
      kind: 'DATES' as const,
      slots: [
        { date: '2099-10-22', time: '14:00' },
        { date: '2099-10-28', time: '' },
        { date: '2099-10-22', time: '14:00' },
      ],
    };
    const found = issues(values);
    expect(found['slots.1.time']).toBe(MESSAGES.slotTimeRequired);
    expect(found['slots.2.time']).toBe(MESSAGES.duplicate);
  });
});

describe('contrato', () => {
  it('solo manda los campos del tipo elegido', () => {
    const values = {
      ...emptyReminderValues('t1'),
      message: '  Llamar  ',
      kind: 'WEEKLY' as const,
      weeklyDays: [5, 1, 3],
      weeklyTime: '09:30',
      dailyTime: '08:00',
    };
    expect(toCreateDto(values, EMPTY_CONTEXT)).toEqual({
      message: 'Llamar',
      taskId: 't1',
      schedule: { kind: 'WEEKLY', weekdays: [1, 3, 5], time: '09:30' },
      soundOnNonWorkingDays: false,
      soundOutsideWorkingHours: false,
    });
  });

  it('PATCH sin `schedule` si la programación no cambió (§3.74 §4)', () => {
    const { values, context } = reminderToForm(stored);
    expect(toUpdateDto({ ...values, message: 'Revisar correos hoy' }, context, stored)).toEqual({
      message: 'Revisar correos hoy',
    });
    // Un par conservado vencido no se valida como «nuevo»: editar el mensaje no choca.
    expect(buildReminderFormSchema(context).safeParse(values).success).toBe(true);
  });

  it('si cambia, la programación viaja entera, con los pares ya resueltos', () => {
    const { values, context } = reminderToForm(stored);
    const dto = toUpdateDto(
      { ...values, slots: [...values.slots, { date: '2099-01-01', time: '08:00' }] },
      context,
      stored,
    );
    expect(dto.schedule).toEqual({
      kind: 'DATES',
      slots: [
        { date: '2020-01-10', time: '09:00' },
        { date: '2020-02-10', time: '09:00' },
        { date: '2099-01-01', time: '08:00' },
      ],
    });
  });

  it('la vista previa espera a que la programación esté completa', () => {
    const values = { ...emptyReminderValues(), kind: 'INTERVAL' as const, everyHours: '2', startTime: '08:00' };
    expect(toPreviewBody(values, EMPTY_CONTEXT)).toBeNull();
    expect(toPreviewBody({ ...values, endTime: '18:00' }, EMPTY_CONTEXT)?.schedule).toEqual({
      kind: 'INTERVAL',
      everyHours: 2,
      startTime: '08:00',
      endTime: '18:00',
      weekdays: [0, 1, 2, 3, 4, 5, 6],
    });
  });
});
