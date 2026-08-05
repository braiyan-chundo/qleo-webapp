import { useMemo } from 'react';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { civilDayToDate, dateToCivilDay } from '@/shared/lib/civil-date';

import { BIRTH_DATE_MIN } from '../lib/birth-date';

interface BirthDateFieldProps {
  /** `id` del disparador, para asociarlo con el `<Label htmlFor>`. */
  id: string;
  /**
   * Valor **tal cual se va a enviar**: día civil `'YYYY-MM-DD'`, o `''` si no hay fecha. El
   * formulario guarda la cadena, no un `Date`: así lo que se manda al backend es exactamente
   * el día que el usuario tocó, sin ningún viaje por UTC de por medio (§3.66).
   */
  value: string;
  /** Recibe el nuevo día civil, o `''` al borrarlo. */
  onChange: (next: string) => void;
  disabled?: boolean;
  /** Mensaje de error del campo (validación local o `error.code` del backend). */
  error?: string;
  /** Texto de ayuda bajo el campo. */
  hint?: string;
}

/**
 * Campo de **fecha de nacimiento** (QL-193, §3.66). Lo comparten "Mi cuenta" y la
 * administración de usuarios, las dos únicas pantallas que pueden editarla.
 *
 * Dos detalles que no son cosméticos:
 * - El valor entra y sale como `'YYYY-MM-DD'`; el `Date` solo existe **dentro** del picker.
 *   `civilDayToDate` ancla el día a mediodía local y `dateToCivilDay` lo serializa con los
 *   componentes locales, así que en `America/Bogota` (UTC-5) el día no se corre.
 * - El calendario abre con desplegables de mes y año acotados a `[1900, hoy]`: una fecha de
 *   nacimiento está a décadas del mes actual y navegarla flecha a flecha no es viable. El
 *   mismo rango va como `disabled`, para que el futuro tampoco sea seleccionable a mano.
 */
export function BirthDateField({
  id,
  value,
  onChange,
  disabled = false,
  error,
  hint,
}: BirthDateFieldProps) {
  const selected = useMemo(() => civilDayToDate(value), [value]);
  // Tope superior: hoy. Se recalcula por montaje, no por render (da igual el minuto exacto).
  const today = useMemo(() => new Date(), []);

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-on-surface">
        Fecha de nacimiento
      </Label>

      <div className="flex items-center gap-2">
        <DatePicker
          id={id}
          value={selected}
          onChange={(date) => onChange(dateToCivilDay(date))}
          placeholder="Sin fecha"
          disabled={disabled}
          captionLayout="dropdown"
          startMonth={BIRTH_DATE_MIN}
          endMonth={today}
          disabledDays={[{ before: BIRTH_DATE_MIN }, { after: today }]}
          className="w-full flex-1"
        />
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            onClick={() => onChange('')}
            aria-label="Quitar la fecha de nacimiento"
            className="shrink-0 text-on-surface-variant"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      {error ? (
        <span className="text-xs font-medium text-error">{error}</span>
      ) : (
        hint && <span className="text-xs text-on-surface-variant">{hint}</span>
      )}
    </div>
  );
}
