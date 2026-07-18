import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { ApiError } from '@/core/api/fetch-client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label as FieldLabel } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { cn } from '@/lib/utils';

import { useUpdateHoliday } from '../hooks/use-work-calendar';
import type { Holiday } from '../services/work-calendar.service';
import { holidayFormSchema, type HolidayFormValues } from '../schemas/holiday.schema';
import { dateToIsoDay, isoDayToDate } from '../lib/holiday-date';

interface HolidayEditDialogProps {
  /** Festivo en edición (siempre MANUAL); `null` mantiene el diálogo cerrado. */
  holiday: Holiday | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Edición de un festivo MANUAL (QL-163, §3.47, solo ADMIN). Solo los MANUAL son editables; los
 * AUTO se gestionan en bloque con el toggle de festivos colombianos, así que este diálogo nunca
 * se abre sobre uno. Traduce los errores semánticos: `AUTO_HOLIDAY_NOT_EDITABLE` (400) y
 * `HOLIDAY_ALREADY_EXISTS` (409, la nueva fecha choca con otro festivo).
 */
export function HolidayEditDialog({ holiday, onOpenChange }: HolidayEditDialogProps) {
  const updateHoliday = useUpdateHoliday();

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<HolidayFormValues>({
    resolver: zodResolver(holidayFormSchema),
    defaultValues: { date: '', name: '' },
  });

  useEffect(() => {
    if (!holiday) return;
    reset({ date: holiday.date, name: holiday.name });
  }, [holiday, reset]);

  const onSubmit = (values: HolidayFormValues) => {
    if (!holiday) return;

    const dto: { date?: string; name?: string } = {};
    if (values.date !== holiday.date) dto.date = values.date;
    if (values.name.trim() !== holiday.name) dto.name = values.name.trim();

    if (Object.keys(dto).length === 0) {
      onOpenChange(false);
      return;
    }

    updateHoliday.mutate(
      { id: holiday.id, dto },
      {
        onSuccess: () => {
          toast.success('Festivo actualizado.');
          onOpenChange(false);
        },
        onError: (err) => {
          if (err instanceof ApiError && err.code === 'AUTO_HOLIDAY_NOT_EDITABLE') {
            toast.error('Los festivos automáticos no se editan uno a uno.');
            return;
          }
          if (err instanceof ApiError && err.code === 'HOLIDAY_ALREADY_EXISTS') {
            toast.error('Ya hay un festivo registrado en esa fecha.');
            return;
          }
          toast.error(err instanceof Error ? err.message : 'No se pudo actualizar el festivo.');
        },
      },
    );
  };

  return (
    <Dialog open={!!holiday} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Editar festivo</DialogTitle>
            <DialogDescription>
              Cambia la fecha o el nombre de este día no laborable manual.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-1.5">
              <FieldLabel htmlFor="edit-holiday-date" className="text-on-surface">
                Fecha <span className="text-error">*</span>
              </FieldLabel>
              <Controller
                control={control}
                name="date"
                render={({ field }) => (
                  <DatePicker
                    id="edit-holiday-date"
                    className={cn('w-full', errors.date && 'border-error')}
                    value={isoDayToDate(field.value)}
                    onChange={(date) => field.onChange(dateToIsoDay(date))}
                    placeholder="Elegir fecha"
                  />
                )}
              />
              {errors.date && (
                <span className="text-xs font-medium text-error">{errors.date.message}</span>
              )}
            </div>

            <div className="grid gap-1.5">
              <FieldLabel htmlFor="edit-holiday-name" className="text-on-surface">
                Nombre <span className="text-error">*</span>
              </FieldLabel>
              <Input
                id="edit-holiday-name"
                placeholder="Ej. Día de la Independencia"
                className={cn('h-10', errors.name && 'border-error')}
                {...register('name')}
              />
              {errors.name && (
                <span className="text-xs font-medium text-error">{errors.name.message}</span>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateHoliday.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={updateHoliday.isPending}>
              {updateHoliday.isPending && <Loader2 className="animate-spin" />}
              Guardar cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
