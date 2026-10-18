import { describe, expect, it } from 'vitest';

import type { ReminderResponseDto, ReminderScheduleResponse } from '../types/reminder.types';
import {
  formatWeekdayRange,
  groupPreviewByDay,
  groupReminders,
  previewFooter,
  reminderGroup,
  scheduleSummary,
} from './reminder-display';

const TODAY = '2026-10-19';

function reminder(schedule: ReminderScheduleResponse, extra: Partial<ReminderResponseDto> = {}) {
  return {
    schedule,
    status: 'ACTIVE' as const,
    blockedReason: null,
    soundOnNonWorkingDays: false,
    soundOutsideWorkingHours: false,
    ...extra,
  };
}

describe('scheduleSummary (resumen de la fila)', () => {
  it('días de la semana: «Lun, mié, vie · 09:30» (AC-03)', () => {
    expect(scheduleSummary(reminder({ kind: 'WEEKLY', weekdays: [5, 1, 3], time: '09:30' }), TODAY)).toBe(
      'Lun, mié, vie · 09:30',
    );
  });

  it('todos los días: «Todos los días · 08:15» (AC-05)', () => {
    expect(scheduleSummary(reminder({ kind: 'DAILY', time: '08:15' }), TODAY)).toBe(
      'Todos los días · 08:15',
    );
  });

  it('cada N horas: «Cada 2 h · 08:00-18:00 · lun-vie» (AC-06)', () => {
    expect(
      scheduleSummary(
        reminder({ kind: 'INTERVAL', everyHours: 2, startTime: '08:00', endTime: '18:00', weekdays: [1, 2, 3, 4, 5] }),
        TODAY,
      ),
    ).toBe('Cada 2 h · 08:00-18:00 · lun-vie');
  });

  it('una vez y fechas sueltas; los cumplidos dicen cuándo', () => {
    const once = { kind: 'ONCE' as const, slots: [{ date: '2026-10-16', time: '10:00', result: 'FIRED' as const }] };
    expect(scheduleSummary(reminder(once), TODAY)).toBe('Una vez');
    expect(scheduleSummary(reminder(once, { status: 'FINISHED' }), TODAY)).toBe('Una vez · vie 16 oct, 10:00');

    const dates = {
      kind: 'DATES' as const,
      slots: [
        { date: '2026-10-13', time: '09:00', result: 'FIRED' as const },
        { date: '2026-10-06', time: '09:00', result: 'FIRED' as const },
      ],
    };
    expect(scheduleSummary(reminder(dates), TODAY)).toBe('2 fechas');
    expect(scheduleSummary(reminder(dates, { status: 'FINISHED' }), TODAY)).toBe('2 fechas · 6 y 13 oct');
  });

  it('añade las casillas marcadas', () => {
    expect(
      scheduleSummary(reminder({ kind: 'ONCE', slots: [] }, { soundOutsideWorkingHours: true }), TODAY),
    ).toBe('Una vez · también fuera del horario');
  });
});

describe('grupos de la lista (§3.74 §2)', () => {
  it('cumplido → Cumplidos; pausa o bloqueo → En pausa; si no, Activos', () => {
    expect(reminderGroup({ status: 'FINISHED', blockedReason: null })).toBe('done');
    expect(reminderGroup({ status: 'PAUSED', blockedReason: null })).toBe('paused');
    expect(reminderGroup({ status: 'ACTIVE', blockedReason: 'TASK_COMPLETED' })).toBe('paused');
    expect(reminderGroup({ status: 'ACTIVE', blockedReason: null })).toBe('active');
  });

  it('conserva el orden del servidor dentro de cada grupo', () => {
    const list = [
      { id: 'a', status: 'ACTIVE' as const, blockedReason: null },
      { id: 'b', status: 'PAUSED' as const, blockedReason: null },
      { id: 'c', status: 'ACTIVE' as const, blockedReason: null },
    ];
    expect(groupReminders(list).active.map((r) => r.id)).toEqual(['a', 'c']);
  });
});

describe('días de «Cada N horas»', () => {
  it('rango, todos o lista', () => {
    expect(formatWeekdayRange([0, 1, 2, 3, 4, 5, 6])).toBe('todos los días');
    expect(formatWeekdayRange([6, 0])).toBe('sáb, dom');
    expect(formatWeekdayRange([1, 3, 5])).toBe('lun, mié, vie');
    expect(formatWeekdayRange([3, 4, 5, 6])).toBe('mié-sáb');
  });
});

describe('vista previa', () => {
  // cada 2 h 08:00-18:00 con jornada 08:00-17:00: se omite la de las 18:00 (AC-37)
  const occurrences = ['13', '15', '17', '19', '21', '23'].map((h) => ({
    at: `2026-10-20T${h}:00:00Z`,
    skipped: h === '23' ? ('OUTSIDE_WORKING_HOURS' as const) : null,
  }));

  it('agrupa por día de Bogotá y marca el motivo', () => {
    const days = groupPreviewByDay(occurrences);
    expect(days).toHaveLength(1);
    expect(days[0].date).toBe('2026-10-20');
    expect(days[0].times.map((t) => t.time)).toEqual(['08:00', '10:00', '12:00', '14:00', '16:00', '18:00']);
    expect(days[0].skipped).toBe('OUTSIDE_WORKING_HOURS');
  });

  it('pie según el tipo', () => {
    expect(previewFooter('INTERVAL', occurrences, false)).toBe('Suenan 5 de 6.');
    expect(previewFooter('INTERVAL', occurrences, true)).toBe(
      'Se muestran los primeros 6 avisos de los próximos 14 días.',
    );
    const daily = Array.from({ length: 14 }, (_, i) => ({
      at: `2026-10-${String(20 + (i % 10)).padStart(2, '0')}T13:15:00Z`,
      skipped: i < 5 ? ('NON_WORKING_DAY' as const) : null,
    }));
    expect(previewFooter('DAILY', daily, false)).toBe('Suenan 9 de 14; se omiten 5 en días no laborales.');
    expect(previewFooter('ONCE', occurrences.slice(0, 1), false)).toBeNull();
  });
});
