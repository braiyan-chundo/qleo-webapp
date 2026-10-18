import { Controller, useFieldArray, useWatch, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import { Check, CircleAlert, Plus, TriangleAlert, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import { civilDayToDate, dateToCivilDay } from '@/shared/lib/civil-date';
import { cn } from '@/lib/utils';

import type { ReminderKind, ReminderSlot, SkipReason } from '../types/reminder.types';
import { formatCivilDay } from '../lib/bogota-time';
import { MAX_DATE_SLOTS } from '../lib/reminder-display';
import type { ReminderFormValues } from '../schemas/reminder-form.schema';
import { StatePill } from './ReminderStatePill';
import { WeekdayToggles } from './WeekdayToggles';

export const WARN_DAY = 'Ese día no es laboral para ti y el aviso no sonará.';
export const WARN_HOUR = 'Esa hora está fuera de tu horario laboral y el aviso no sonará.';

/** Advertencias que salen de la vista previa (`skipped`); nunca bloquean el guardado (DS-5). */
export interface ScheduleWarnings {
  once: SkipReason | null;
  /** Hora de «Todos los días» / «Días de la semana» fuera de jornada (AC-38). */
  hour: boolean;
  /** Por índice de fila de fechas sueltas. */
  slots: (SkipReason | null)[];
  intervalStart: boolean;
  intervalEnd: boolean;
}

interface ReminderScheduleFieldsProps {
  kind: ReminderKind;
  control: Control<ReminderFormValues>;
  register: UseFormRegister<ReminderFormValues>;
  errors: FieldErrors<ReminderFormValues>;
  warnings: ScheduleWarnings;
  /** Pares ya resueltos (editar fechas sueltas): solo lectura. */
  resolvedSlots: ReminderSlot[];
  today: string;
  maxDay: string;
  disabled?: boolean;
}

export function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return (
    <p role="alert" className="flex items-start gap-1.5 text-xs font-medium text-error">
      <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

export function FieldWarning({ children }: { children?: string | null }) {
  if (!children) return null;
  return (
    <p className="flex items-start gap-1.5 text-xs font-medium text-warning">
      <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

function warnFor(reason: SkipReason | null): string | null {
  if (reason === 'NON_WORKING_DAY') return WARN_DAY;
  if (reason === 'OUTSIDE_WORKING_HOURS') return WARN_HOUR;
  return null;
}

function Required() {
  return <span className="text-error">*</span>;
}

const TIME_CLASS = 'h-10 tabular-nums max-md:h-11';

/**
 * Los campos de cada tipo de programación (AC-02…AC-06, D-5, D-6). Ninguna hora trae valor por
 * defecto (DS-3). Las fechas elegibles van de hoy (Bogotá) a hoy + 366 días (B-1).
 */
export function ReminderScheduleFields({
  kind,
  control,
  register,
  errors,
  warnings,
  resolvedSlots,
  today,
  maxDay,
  disabled,
}: ReminderScheduleFieldsProps) {
  const { fields, append, remove, update } = useFieldArray({ control, name: 'slots' });
  const slotValues = useWatch({ control, name: 'slots' });
  const disabledDays = [
    { before: civilDayToDate(today) as Date },
    { after: civilDayToDate(maxDay) as Date },
  ];
  const startMonth = civilDayToDate(today);
  const endMonth = civilDayToDate(maxDay);

  if (kind === 'ONCE') {
    const error = errors.onceDate?.message ?? errors.onceTime?.message;
    return (
      <div className="grid gap-1.5">
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="reminder-once-date" className="text-on-surface">
              Fecha <Required />
            </Label>
            <Controller
              control={control}
              name="onceDate"
              render={({ field }) => (
                <DatePicker
                  id="reminder-once-date"
                  touch
                  className="w-full"
                  value={civilDayToDate(field.value)}
                  onChange={(date) => field.onChange(dateToCivilDay(date))}
                  disabledDays={disabledDays}
                  startMonth={startMonth}
                  endMonth={endMonth}
                  disabled={disabled}
                  aria-invalid={!!errors.onceDate}
                />
              )}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="reminder-once-time" className="text-on-surface">
              Hora <Required />
            </Label>
            <Input
              id="reminder-once-time"
              type="time"
              className={TIME_CLASS}
              aria-invalid={!!errors.onceTime || undefined}
              disabled={disabled}
              {...register('onceTime')}
            />
          </div>
        </div>
        <FieldError>{error}</FieldError>
        {!error && <FieldWarning>{warnFor(warnings.once)}</FieldWarning>}
      </div>
    );
  }

  if (kind === 'DAILY') {
    return (
      <div className="grid gap-1.5 md:max-w-[50%]">
        <Label htmlFor="reminder-daily-time" className="text-on-surface">
          Hora <Required />
        </Label>
        <Input
          id="reminder-daily-time"
          type="time"
          className={TIME_CLASS}
          aria-invalid={!!errors.dailyTime || undefined}
          disabled={disabled}
          {...register('dailyTime')}
        />
        <FieldError>{errors.dailyTime?.message}</FieldError>
        {!errors.dailyTime && warnings.hour && <FieldWarning>{WARN_HOUR}</FieldWarning>}
      </div>
    );
  }

  if (kind === 'WEEKLY') {
    return (
      <>
        <div className="grid gap-1.5">
          <Label htmlFor="reminder-weekly-days" className="text-on-surface">
            Días <Required />
          </Label>
          <Controller
            control={control}
            name="weeklyDays"
            render={({ field }) => (
              <WeekdayToggles
                id="reminder-weekly-days"
                value={field.value}
                onChange={field.onChange}
                invalid={!!errors.weeklyDays}
                disabled={disabled}
              />
            )}
          />
          <FieldError>{errors.weeklyDays?.message}</FieldError>
        </div>
        <div className="grid gap-1.5 md:max-w-[50%]">
          <Label htmlFor="reminder-weekly-time" className="text-on-surface">
            Hora <Required />
          </Label>
          <Input
            id="reminder-weekly-time"
            type="time"
            className={TIME_CLASS}
            aria-invalid={!!errors.weeklyTime || undefined}
            disabled={disabled}
            {...register('weeklyTime')}
          />
          <FieldError>{errors.weeklyTime?.message}</FieldError>
          {!errors.weeklyTime && warnings.hour && <FieldWarning>{WARN_HOUR}</FieldWarning>}
        </div>
      </>
    );
  }

  if (kind === 'DATES') {
    const total = resolvedSlots.length + fields.length;
    return (
      <div className="grid gap-2">
        <Label className="text-on-surface">
          Fechas y horas <Required />
        </Label>

        {/* Editar: lo que ya sonó (o no) se ve, pero no se toca. */}
        {resolvedSlots.map((slot) => (
          <div
            key={`${slot.date}|${slot.time}`}
            className="flex flex-wrap items-center gap-2 py-1.5 text-[13px] text-on-surface-variant"
          >
            <Check className="size-3.5" aria-hidden />
            <span className="tabular-nums">
              {formatCivilDay(slot.date, today)} · {slot.time}
            </span>
            {slot.result === 'FIRED' ? (
              <StatePill>Sonó</StatePill>
            ) : (
              <StatePill tone="warning">No sonó</StatePill>
            )}
            <span className="text-xs">ya pasó; no se edita</span>
          </div>
        ))}

        {fields.map((item, index) => {
          const slotErrors = errors.slots?.[index];
          const error = slotErrors?.date?.message ?? slotErrors?.time?.message;
          // Con una sola fila (y nada resuelto) la ✕ la vacía en vez de quitarla; vacía, no sale.
          const removable = fields.length > 1 || resolvedSlots.length > 0;
          const filled = !!(slotValues?.[index]?.date || slotValues?.[index]?.time);
          return (
            <div key={item.id} className="grid gap-1.5">
              <div className="grid grid-cols-[1fr_120px_36px] items-start gap-2 max-md:grid-cols-[1fr_104px_44px]">
                <Controller
                  control={control}
                  name={`slots.${index}.date`}
                  render={({ field }) => (
                    <DatePicker
                      touch
                      className="w-full"
                      aria-label={`Fecha ${index + 1}`}
                      value={civilDayToDate(field.value)}
                      onChange={(date) => field.onChange(dateToCivilDay(date))}
                      disabledDays={disabledDays}
                      startMonth={startMonth}
                      endMonth={endMonth}
                      disabled={disabled}
                      aria-invalid={!!slotErrors?.date}
                    />
                  )}
                />
                <Input
                  type="time"
                  aria-label={`Hora de la fecha ${index + 1}`}
                  className={TIME_CLASS}
                  aria-invalid={!!slotErrors?.time || undefined}
                  disabled={disabled}
                  {...register(`slots.${index}.time`)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Quitar esta fecha"
                  disabled={disabled}
                  className={cn('h-10 w-9 text-on-surface-variant max-md:size-11', !removable && !filled && 'invisible')}
                  onClick={() => (removable ? remove(index) : update(index, { date: '', time: '' }))}
                >
                  <X className="size-4" />
                </Button>
              </div>
              <FieldError>{error}</FieldError>
              {!error && <FieldWarning>{warnFor(warnings.slots[index] ?? null)}</FieldWarning>}
            </div>
          );
        })}

        <FieldError>{errors.slots?.root?.message ?? errors.slots?.message}</FieldError>

        <div>
          <Button
            type="button"
            variant="ghost"
            className="max-md:h-11"
            disabled={disabled || total >= MAX_DATE_SLOTS}
            onClick={() => append({ date: '', time: '' })}
          >
            <Plus />
            Añadir fecha
          </Button>
        </div>
        <p className="text-xs text-on-surface-variant">
          Cada fecha lleva su propia hora. Hasta {MAX_DATE_SLOTS}.
        </p>
      </div>
    );
  }

  // INTERVAL
  const rangeError = errors.everyHours?.message;
  const timesError = errors.startTime?.message ?? errors.endTime?.message;
  return (
    <>
      <div className="grid gap-1.5">
        <div className="grid grid-cols-[auto_1fr_1fr] items-end gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="reminder-every" className="text-on-surface">
              Cada <Required />
            </Label>
            <InputGroup className="h-10 w-[120px] max-md:h-11">
              <InputGroupInput
                id="reminder-every"
                type="number"
                inputMode="numeric"
                min={1}
                max={12}
                step={1}
                placeholder="2"
                className="tabular-nums"
                aria-invalid={!!errors.everyHours || undefined}
                disabled={disabled}
                {...register('everyHours')}
              />
              <InputGroupAddon align="inline-end">horas</InputGroupAddon>
            </InputGroup>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="reminder-start" className="text-on-surface">
              Desde <Required />
            </Label>
            <Input
              id="reminder-start"
              type="time"
              className={TIME_CLASS}
              aria-invalid={!!errors.startTime || !!errors.endTime || undefined}
              disabled={disabled}
              {...register('startTime')}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="reminder-end" className="text-on-surface">
              Hasta <Required />
            </Label>
            <Input
              id="reminder-end"
              type="time"
              className={TIME_CLASS}
              aria-invalid={!!errors.startTime || !!errors.endTime || undefined}
              disabled={disabled}
              {...register('endTime')}
            />
          </div>
        </div>
        <FieldError>{rangeError}</FieldError>
        <FieldError>{timesError}</FieldError>
        {!timesError && warnings.intervalStart && <FieldWarning>{`«Desde»: ${WARN_HOUR}`}</FieldWarning>}
        {!timesError && warnings.intervalEnd && <FieldWarning>{`«Hasta»: ${WARN_HOUR}`}</FieldWarning>}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="reminder-interval-days" className="text-on-surface">
          Días <Required />
        </Label>
        <Controller
          control={control}
          name="intervalDays"
          render={({ field }) => (
            <WeekdayToggles
              id="reminder-interval-days"
              value={field.value}
              onChange={field.onChange}
              invalid={!!errors.intervalDays}
              disabled={disabled}
            />
          )}
        />
        <FieldError>{errors.intervalDays?.message}</FieldError>
      </div>
    </>
  );
}
