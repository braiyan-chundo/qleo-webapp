import { ApiError } from '@/core/api/fetch-client';
import { dayMonthLabel, formatCivilDay } from '@/shared/lib/civil-date';

/**
 * Reglas de la **fecha de nacimiento** (QL-193, §3.66) compartidas por las dos únicas
 * pantallas que la editan: "Mi cuenta" (`PATCH /users/me`) y la administración de usuarios
 * (`POST /users` · `PATCH /users/:id`).
 *
 * La conversión `'YYYY-MM-DD'` ⇄ `Date` vive en `@/shared/lib/civil-date`; aquí solo lo
 * específico del campo: sus límites y la traducción de sus `error.code`.
 */

/** Año mínimo aceptado por el backend (anterior → 400 `BIRTH_DATE_OUT_OF_RANGE`). */
export const BIRTH_DATE_MIN_YEAR = 1900;

/** Primer día seleccionable en el date-picker (espejo de `BIRTH_DATE_MIN_YEAR`). */
export const BIRTH_DATE_MIN = new Date(BIRTH_DATE_MIN_YEAR, 0, 1, 12, 0, 0);

/** Mensajes de los `error.code` del campo (§3.66). Se responde al código, nunca al texto. */
const BIRTH_DATE_ERRORS: Record<string, string> = {
  BIRTH_DATE_INVALID: 'La fecha de nacimiento no es válida. Revisa el día elegido.',
  BIRTH_DATE_IN_FUTURE: 'La fecha de nacimiento no puede ser futura.',
  BIRTH_DATE_OUT_OF_RANGE: `La fecha de nacimiento debe ser posterior a ${BIRTH_DATE_MIN_YEAR}.`,
};

/**
 * Traduce un fallo de la API a un mensaje para el usuario, dando prioridad a los códigos de
 * la fecha de nacimiento. Si el error es de otra cosa, cae al `fallback` del llamador.
 */
export function birthDateErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.code && BIRTH_DATE_ERRORS[err.code]) {
    return BIRTH_DATE_ERRORS[err.code];
  }
  return err instanceof Error ? err.message : fallback;
}

/** Lo mínimo que hace falta de un usuario para saber (y mostrar) su cumpleaños. */
export interface BirthdayFields {
  birthDate?: string | null;
  birthDay?: number | null;
  birthMonth?: number | null;
}

/**
 * Etiqueta del cumpleaños con la privacidad ya resuelta:
 * - con `birthDate` visible (soy yo o soy ADMIN) → fecha completa, "12 may 1990";
 * - si solo llegan día y mes → "12 de mayo", **sin año** (nadie deduce la edad);
 * - sin cumpleaños → `null` (el llamador decide el guion).
 *
 * El "¿tiene cumpleaños?" se decide con `birthDay`/`birthMonth`, **nunca** con `birthDate`:
 * esa llega `null` a quien no es su dueño ni ADMIN, así que usarla como sonda pintaría
 * "sin cumpleaños" en todo el directorio (§3.66).
 */
export function birthdayLabel(user: BirthdayFields): string | null {
  if (user.birthDate) return formatCivilDay(user.birthDate);
  const { birthDay, birthMonth } = user;
  if (birthDay != null && birthMonth != null) return dayMonthLabel(birthDay, birthMonth);
  return null;
}
