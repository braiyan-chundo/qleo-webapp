import * as React from 'react';
import { es } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import type { Matcher } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

/**
 * Selector de fecha (shadcn: Popover + Calendar). Reemplaza los `<input type="date">`
 * nativos. **Controlado** y con convención de valor `Date | undefined` (no string): cada
 * llamador convierte su formato de almacenamiento (ISO o `yyyy-mm-dd`) a/desde `Date` en el
 * borde. Localizado en español, semana empezando en lunes (coherente con el Planner/Gantt).
 */
export interface DatePickerProps {
  /** Fecha seleccionada, o `undefined` si no hay ninguna. */
  value: Date | undefined;
  /** Se dispara al elegir un día (o al limpiar → `undefined`). */
  onChange: (date: Date | undefined) => void;
  /** Texto cuando no hay fecha (por defecto "Elegir fecha"). */
  placeholder?: string;
  disabled?: boolean;
  /** `id` del disparador, para asociarlo con un `<Label htmlFor>`. */
  id?: string;
  /** Días deshabilitados (p. ej. `{ before: new Date() }` para no permitir el pasado). */
  disabledDays?: Matcher | Matcher[];
  /** Clases extra para el botón disparador (ancho, alto, estados de error…). */
  className?: string;
  /** Texto para lectores de pantalla si no hay `<Label>` asociado. */
  'aria-label'?: string;
}

/** Fecha legible en español, ej. "10 jul 2026". */
function formatValue(date: Date): string {
  return date.toLocaleDateString('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Elegir fecha',
  disabled = false,
  id,
  disabledDays,
  className,
  'aria-label': ariaLabel,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (date: Date | undefined) => {
    onChange(date);
    // Cierra el popover al elegir un día.
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn(
            'h-10 justify-start gap-2 px-3 font-normal',
            !value && 'text-on-surface-variant',
            className,
          )}
        >
          <CalendarIcon className="size-4 shrink-0 text-on-surface-variant" />
          {value ? formatValue(value) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={handleSelect}
          disabled={disabledDays}
          locale={es}
          weekStartsOn={1}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
