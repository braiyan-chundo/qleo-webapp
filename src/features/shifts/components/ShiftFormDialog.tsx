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
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

import { useCreateShift, useUpdateShift } from '../hooks/use-shifts';
import type { Shift } from '../services/shifts.service';
import { hmToMinutes, minutesToHm } from '../lib/shift';
import { shiftFormSchema, type ShiftFormValues } from '../schemas/shift.schema';

/** Color por defecto de un turno nuevo si el usuario no elige otro. */
const DEFAULT_COLOR = '#2563eb';

interface ShiftFormDialogProps {
  open: boolean;
  /** Turno en edición; `null`/ausente = alta de un turno nuevo. */
  shift?: Shift | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Alta/edición de un turno del catálogo (QL-163, §3.46, solo ADMIN). Las horas se editan con
 * `<input type="time">` (minutos desde la medianoche por debajo). Traduce los errores semánticos
 * del backend (`SHIFT_NAME_TAKEN` 409, `SHIFT_INVALID_RANGE` 400) a mensajes claros.
 */
export function ShiftFormDialog({ open, shift, onOpenChange }: ShiftFormDialogProps) {
  const isEdit = !!shift;
  const createShift = useCreateShift();
  const updateShift = useUpdateShift();
  const isPending = createShift.isPending || updateShift.isPending;

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ShiftFormValues>({
    resolver: zodResolver(shiftFormSchema),
    defaultValues: { name: '', start: '08:00', end: '17:00', color: DEFAULT_COLOR, active: true },
  });

  // Rehidratar cada vez que se abre (con otro turno, o para un alta limpia).
  useEffect(() => {
    if (!open) return;
    if (shift) {
      reset({
        name: shift.name,
        start: minutesToHm(shift.startMinute),
        end: minutesToHm(shift.endMinute),
        color: shift.color,
        active: shift.active,
      });
    } else {
      reset({ name: '', start: '08:00', end: '17:00', color: DEFAULT_COLOR, active: true });
    }
  }, [open, shift, reset]);

  const color = watch('color');

  const onError = (err: unknown) => {
    if (err instanceof ApiError && err.code === 'SHIFT_NAME_TAKEN') {
      toast.error('Ya existe un turno con ese nombre.');
      return;
    }
    if (err instanceof ApiError && err.code === 'SHIFT_INVALID_RANGE') {
      toast.error('El horario del turno no es válido (la hora de fin debe ser posterior).');
      return;
    }
    toast.error(err instanceof Error ? err.message : 'No se pudo guardar el turno.');
  };

  const onSubmit = (values: ShiftFormValues) => {
    const startMinute = hmToMinutes(values.start);
    const endMinute = hmToMinutes(values.end);
    if (startMinute === null || endMinute === null) return;

    if (isEdit && shift) {
      updateShift.mutate(
        {
          id: shift.id,
          dto: {
            name: values.name.trim(),
            startMinute,
            endMinute,
            color: values.color,
            active: values.active,
          },
        },
        {
          onSuccess: () => {
            toast.success('Turno actualizado.');
            onOpenChange(false);
          },
          onError,
        },
      );
      return;
    }

    createShift.mutate(
      {
        name: values.name.trim(),
        startMinute,
        endMinute,
        ...(values.color ? { color: values.color } : {}),
      },
      {
        onSuccess: () => {
          toast.success('Turno creado.');
          onOpenChange(false);
        },
        onError,
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Editar turno' : 'Nuevo turno'}</DialogTitle>
            <DialogDescription>
              Un turno es una franja horaria reutilizable. Las mallas lo asignan por día de la
              semana.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-1.5">
              <FieldLabel htmlFor="shift-name" className="text-on-surface">
                Nombre <span className="text-error">*</span>
              </FieldLabel>
              <Input
                id="shift-name"
                placeholder="Ej. Mañana"
                className={cn('h-10', errors.name && 'border-error')}
                {...register('name')}
              />
              {errors.name && (
                <span className="text-xs font-medium text-error">{errors.name.message}</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <FieldLabel htmlFor="shift-start" className="text-on-surface">
                  Inicio <span className="text-error">*</span>
                </FieldLabel>
                <Input
                  id="shift-start"
                  type="time"
                  className={cn('h-10', errors.start && 'border-error')}
                  {...register('start')}
                />
                {errors.start && (
                  <span className="text-xs font-medium text-error">{errors.start.message}</span>
                )}
              </div>
              <div className="grid gap-1.5">
                <FieldLabel htmlFor="shift-end" className="text-on-surface">
                  Fin <span className="text-error">*</span>
                </FieldLabel>
                <Input
                  id="shift-end"
                  type="time"
                  className={cn('h-10', errors.end && 'border-error')}
                  {...register('end')}
                />
                {errors.end && (
                  <span className="text-xs font-medium text-error">{errors.end.message}</span>
                )}
              </div>
            </div>

            <div className="grid gap-1.5">
              <span className="text-sm font-medium text-on-surface">Color</span>
              <div className="flex items-center gap-3">
                <Controller
                  control={control}
                  name="color"
                  render={({ field }) => (
                    <input
                      type="color"
                      aria-label="Color del turno"
                      value={field.value ?? DEFAULT_COLOR}
                      onChange={(e) => field.onChange(e.target.value)}
                      className="size-10 cursor-pointer rounded-md border border-outline-variant/60 bg-surface-container-low"
                    />
                  )}
                />
                <span className="text-sm tabular-nums text-on-surface-variant">
                  {color ?? 'Sin color'}
                </span>
                {color && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-on-surface-variant"
                    onClick={() => setValue('color', null, { shouldDirty: true })}
                  >
                    Quitar color
                  </Button>
                )}
              </div>
            </div>

            {isEdit && (
              <Controller
                control={control}
                name="active"
                render={({ field }) => (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant/60 bg-surface-container-low p-3">
                    <div className="grid gap-0.5">
                      <FieldLabel htmlFor="shift-active" className="text-on-surface">
                        Turno activo
                      </FieldLabel>
                      <span className="text-xs text-on-surface-variant">
                        Un turno retirado no se ofrece en mallas nuevas.
                      </span>
                    </div>
                    <Switch
                      id="shift-active"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </div>
                )}
              />
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="animate-spin" />}
              {isEdit ? 'Guardar cambios' : 'Crear turno'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
