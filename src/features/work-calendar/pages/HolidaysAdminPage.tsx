import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { CalendarDays, Loader2, Plus, Trash2 } from 'lucide-react';

import { ApiError } from '@/core/api/fetch-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DataCard, DataTableCard } from '@/shared/components/data-table';
import { HolidayCalendar } from '../components/HolidayCalendar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

import {
  useCreateHoliday,
  useDeleteHoliday,
  useHolidays,
} from '../hooks/use-work-calendar';
import { DatePicker } from '@/components/ui/date-picker';

import { holidayFormSchema, type HolidayFormValues } from '../schemas/holiday.schema';
import type { Holiday } from '../services/work-calendar.service';

const ALL_YEARS = 'ALL';

/** `yyyy-mm-dd` → `Date` local (mediodía) para el DatePicker, o `undefined` si vacío. */
function isoDayToDate(value: string): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day, 12, 0, 0);
}

/** `Date` local → `yyyy-mm-dd` (lo que espera el backend de festivos), o `''` si no hay. */
function dateToIsoDay(date: Date | undefined): string {
  if (!date || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Formatea un `YYYY-MM-DD` a fecha legible en español (ej. "6 jul 2026"). */
function formatHolidayDate(isoDay: string): string {
  const [year, month, day] = isoDay.split('-').map(Number);
  if (!year || !month || !day) return isoDay;
  return new Date(year, month - 1, day).toLocaleDateString('es', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Pantalla de administración de festivos (QL-10, §3.12). Solo ADMIN (montada bajo
 * `AdminRoute`). Lista los festivos, permite añadir (rhf+zod) y borrar (con confirmación).
 */
export function HolidaysAdminPage() {
  const currentYear = new Date().getFullYear();
  const [yearFilter, setYearFilter] = useState<string>(ALL_YEARS);
  const [toDelete, setToDelete] = useState<Holiday | null>(null);

  const params = useMemo(
    () => (yearFilter === ALL_YEARS ? undefined : { year: Number(yearFilter) }),
    [yearFilter],
  );

  const { data: holidays = [], isLoading, isError, error } = useHolidays(params);
  const createHoliday = useCreateHoliday();
  const deleteHoliday = useDeleteHoliday();

  const yearOptions = useMemo(
    () => Array.from({ length: 5 }, (_, i) => currentYear - 1 + i),
    [currentYear],
  );

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<HolidayFormValues>({
    resolver: zodResolver(holidayFormSchema),
    defaultValues: { date: '', name: '' },
  });

  const selectedDate = watch('date');

  const onSubmit = (values: HolidayFormValues) => {
    createHoliday.mutate(
      { date: values.date, name: values.name.trim() },
      {
        onSuccess: () => {
          toast.success('Festivo añadido');
          reset({ date: '', name: '' });
        },
        onError: (err) => {
          if (err instanceof ApiError && err.code === 'HOLIDAY_ALREADY_EXISTS') {
            toast.error('Ya hay un festivo registrado ese día');
            return;
          }
          toast.error(
            err instanceof Error ? err.message : 'No se pudo añadir el festivo',
          );
        },
      },
    );
  };

  const handleDelete = () => {
    if (!toDelete) return;
    deleteHoliday.mutate(toDelete.id, {
      onSuccess: () => {
        toast.success('Festivo eliminado');
        setToDelete(null);
      },
      onError: (err) => {
        toast.error(
          err instanceof Error ? err.message : 'No se pudo eliminar el festivo',
        );
      },
    });
  };

  return (
    <div className="p-4 md:p-8">
      {/* Encabezado */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-on-surface">Calendario laboral</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Gestiona los días festivos. Los fines de semana ya se consideran no laborables. El
          sistema solo avisa al fijar fechas límite; no reprograma tareas.
        </p>
      </div>

      {/* Calendario visual: fines de semana atenuados + festivos resaltados */}
      <div className="mb-8">
        <HolidayCalendar
          holidays={holidays}
          selectedDate={selectedDate}
          onSelectDate={(iso) =>
            setValue('date', iso, { shouldValidate: true, shouldDirty: true })
          }
        />
        <p className="mt-2 text-xs text-on-surface-variant">
          Haz clic en un día para prellenar la fecha del formulario.
        </p>
      </div>

      {/* Formulario: añadir festivo */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="mb-8 grid gap-4 rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-4 sm:grid-cols-[10rem_1fr_auto] sm:items-end"
      >
        <div className="grid gap-1.5">
          <Label htmlFor="holiday-date" className="text-xs text-on-surface-variant">
            Fecha <span className="text-error">*</span>
          </Label>
          <Controller
            control={control}
            name="date"
            render={({ field }) => (
              <DatePicker
                id="holiday-date"
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
          <Label htmlFor="holiday-name" className="text-xs text-on-surface-variant">
            Nombre <span className="text-error">*</span>
          </Label>
          <Input
            id="holiday-name"
            placeholder="Ej. Día de la Independencia"
            className={cn('h-10', errors.name && 'border-error')}
            {...register('name')}
          />
          {errors.name && (
            <span className="text-xs font-medium text-error">{errors.name.message}</span>
          )}
        </div>

        <Button type="submit" className="h-10" disabled={createHoliday.isPending}>
          {createHoliday.isPending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          Añadir festivo
        </Button>
      </form>

      {/* Filtro por año */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-sm text-on-surface-variant">
          {holidays.length} {holidays.length === 1 ? 'festivo' : 'festivos'}
        </p>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="h-10 w-40">
            <SelectValue placeholder="Año" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_YEARS}>Todos los años</SelectItem>
            {yearOptions.map((year) => (
              <SelectItem key={year} value={String(year)}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Contenido */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-error/20 bg-error-container px-6 py-10 text-center">
          <p className="text-sm font-medium text-on-error-container">
            No se pudieron cargar los festivos
          </p>
          <p className="mt-1 text-xs text-on-error-container/80">
            {error instanceof Error ? error.message : 'Error desconocido'}
          </p>
        </div>
      ) : holidays.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant/60 bg-surface-container-low px-6 py-16 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-primary-container text-primary">
            <CalendarDays className="size-7" />
          </div>
          <h2 className="text-lg font-semibold text-on-surface">Sin festivos</h2>
          <p className="mt-1 max-w-sm text-sm text-on-surface-variant">
            Añade festivos con el formulario de arriba para que el sistema avise al fijar
            fechas límite.
          </p>
        </div>
      ) : (
        <DataTableCard
          cards={holidays.map((holiday) => (
            <DataCard key={holiday.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-on-surface">{holiday.name}</p>
                  <p className="mt-0.5 text-sm text-on-surface-variant">
                    {formatHolidayDate(holiday.date)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-on-surface-variant hover:text-error"
                  onClick={() => setToDelete(holiday)}
                  aria-label={`Eliminar ${holiday.name}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </DataCard>
          ))}
        >
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {holidays.map((holiday) => (
              <TableRow key={holiday.id}>
                <TableCell className="font-medium text-on-surface">
                  {formatHolidayDate(holiday.date)}
                </TableCell>
                <TableCell className="text-on-surface">{holiday.name}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-on-surface-variant hover:text-error"
                    onClick={() => setToDelete(holiday)}
                    aria-label={`Eliminar ${holiday.name}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </DataTableCard>
      )}

      {/* Confirmación de borrado */}
      <AlertDialog
        open={!!toDelete}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar festivo?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete
                ? `Se eliminará "${toDelete.name}" (${formatHolidayDate(toDelete.date)}). Esta acción no se puede deshacer.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteHoliday.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleteHoliday.isPending}
            >
              {deleteHoliday.isPending && <Loader2 className="animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
