import { describe, expect, it } from 'vitest';

import {
  addCivilDays,
  bogotaToday,
  civilWeekday,
  formatCivilDay,
  formatNextFire,
  formatPreviewDay,
  isCivilPast,
  toBogotaCivil,
} from './bogota-time';

// Lunes 19 oct 2026, 10:12 a. m. en Bogotá (UTC-5) — el «hoy» de la maqueta.
const NOW = new Date('2026-10-19T15:12:00Z');

describe('bogota-time', () => {
  it('corre con el dispositivo en otra zona horaria (AC-12)', () => {
    // Bogotá es UTC-5 todo el año (300 min); si esto fallara, las pruebas no demostrarían nada.
    expect(new Date(2026, 0, 1).getTimezoneOffset()).not.toBe(300);
  });

  it('lee un instante UTC como hora civil de Bogotá, cruzando la medianoche', () => {
    expect(toBogotaCivil('2026-10-20T04:30:00Z')).toEqual({ date: '2026-10-19', time: '23:30' });
    expect(toBogotaCivil('2026-10-20T05:00:00Z')).toEqual({ date: '2026-10-20', time: '00:00' });
    expect(toBogotaCivil('2027-01-01T04:59:00Z')).toEqual({ date: '2026-12-31', time: '23:59' });
  });

  it('«hoy» es el de Bogotá, no el del dispositivo', () => {
    // 21:00 en Bogotá del 19 = 20 oct en Tokio.
    expect(bogotaToday(new Date('2026-10-20T02:00:00Z'))).toBe('2026-10-19');
  });

  it('aritmética de días civiles sin saltos', () => {
    expect(addCivilDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addCivilDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addCivilDays('2026-10-19', 366)).toBe('2027-10-20');
    expect(civilWeekday('2026-10-19')).toBe(1); // lunes
    expect(civilWeekday('2026-10-25')).toBe(0); // domingo
  });

  it('«Próximo»: hoy, mañana o el día con su nombre', () => {
    expect(formatNextFire('2026-10-19T19:00:00Z', NOW)).toBe('hoy, 14:00');
    expect(formatNextFire('2026-10-20T13:15:00Z', NOW)).toBe('mañana, 08:15');
    expect(formatNextFire('2026-10-21T14:30:00Z', NOW)).toBe('mié 21 oct, 09:30');
  });

  it('días de la vista previa y fechas de otro año', () => {
    expect(formatPreviewDay('2026-10-19', '2026-10-19')).toBe('hoy, lun 19 oct');
    expect(formatPreviewDay('2026-10-20', '2026-10-19')).toBe('mañana, mar 20 oct');
    expect(formatPreviewDay('2026-10-21', '2026-10-19')).toBe('mié 21 oct');
    expect(formatCivilDay('2027-01-04', '2026-10-19')).toBe('lun 4 ene 2027');
  });

  it('un par civil ya pasó si es igual o anterior al minuto actual de Bogotá', () => {
    expect(isCivilPast('2026-10-19', '10:12', NOW)).toBe(true);
    expect(isCivilPast('2026-10-19', '10:13', NOW)).toBe(false);
    expect(isCivilPast('2026-10-18', '23:59', NOW)).toBe(true);
  });
});
