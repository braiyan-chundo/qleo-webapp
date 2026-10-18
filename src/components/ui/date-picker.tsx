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
  /**
   * Cabecera del calendario: `'label'` (mes fijo, por defecto) o `'dropdown'` (selectores de
   * mes y año). Úsalo cuando la fecha puede estar muy lejos del mes actual —una fecha de
   * nacimiento, por ejemplo—, donde avanzar mes a mes no es viable. Acótalo con
   * `startMonth`/`endMonth`: son los que definen el rango del desplegable de años.
   */
  captionLayout?: React.ComponentProps<typeof Calendar>['captionLayout'];
  /** Primer mes navegable (y primer año del desplegable). */
  startMonth?: Date;
  /** Último mes navegable (y último año del desplegable). */
  endMonth?: Date;
  /** Clases extra para el botón disparador (ancho, alto, estados de error…). */
  className?: string;
  /** Texto para lectores de pantalla si no hay `<Label>` asociado. */
  'aria-label'?: string;
  /** Marca el campo con error (borde `destructive`). */
  'aria-invalid'?: boolean;
  /**
   * (HU-0202, ficha `date-picker`) Modo táctil: en el teléfono (< 768 px) la celda del calendario
   * pasa a 44 px y el disparador a `h-11` con texto de 16 px. En escritorio no cambia nada.
   */
  touch?: boolean;
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
  captionLayout,
  startMonth,
  endMonth,
  className,
  'aria-label': ariaLabel,
  'aria-invalid': ariaInvalid,
  touch = false,
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
          aria-invalid={ariaInvalid || undefined}
          className={cn(
            'h-10 justify-start gap-2 px-3 font-normal',
            touch && 'max-md:h-11 max-md:text-base',
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
          captionLayout={captionLayout}
          startMonth={startMonth}
          endMonth={endMonth}
          locale={es}
          weekStartsOn={1}
          autoFocus
          className={touch ? 'max-md:[--cell-size:--spacing(11)]' : undefined}
        />
      </PopoverContent>
    </Popover>
  );
}
