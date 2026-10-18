import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

import { WEEKDAY_FULL, WEEKDAY_ORDER, WEEKDAY_SHORT } from '../lib/reminder-display';

interface WeekdayTogglesProps {
  id?: string;
  value: number[];
  onChange: (days: number[]) => void;
  invalid?: boolean;
  disabled?: boolean;
}

/** Clases de un botón de la tira (tipo o día): primario contenedor al marcarlo, 44 px en el teléfono. */
export const TOGGLE_ITEM_CLASS =
  'h-8 min-w-11 border border-outline-variant/50 px-2.5 text-on-surface max-md:h-11 data-[state=on]:border-transparent data-[state=on]:bg-primary-container data-[state=on]:text-on-primary-container';

/**
 * Días de la semana, de lunes a domingo (AC-03, D-6). El valor usa la convención del contrato:
 * 0 = domingo … 6 = sábado. Cada botón lleva el nombre completo para lectores de pantalla.
 */
export function WeekdayToggles({ id, value, onChange, invalid, disabled }: WeekdayTogglesProps) {
  return (
    <ToggleGroup
      id={id}
      type="multiple"
      value={value.map(String)}
      onValueChange={(next) => onChange(next.map(Number))}
      disabled={disabled}
      aria-label="Días de la semana"
      aria-invalid={invalid || undefined}
      className="flex-wrap"
      spacing={1.5}
    >
      {WEEKDAY_ORDER.map((day) => (
        <ToggleGroupItem
          key={day}
          value={String(day)}
          aria-label={WEEKDAY_FULL[day]}
          className={cn(TOGGLE_ITEM_CLASS, invalid && 'border-destructive')}
        >
          {WEEKDAY_SHORT[day].charAt(0).toUpperCase() + WEEKDAY_SHORT[day].slice(1)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
