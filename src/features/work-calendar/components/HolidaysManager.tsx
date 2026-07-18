import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { CalendarDays, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';

import { ApiError } from '@/core/api/fetch-client';
import { Badge } from '@/components/ui/badge';
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
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DataCard, DataTableCard } from '@/shared/components/data-table';
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
import { DatePicker } from '@/components/ui/date-picker';
import { cn } from '@/lib/utils';

import {
  useCalendarConfig,
  useCreateHoliday,
  useDeleteHoliday,
  useHolidays,
} from '../hooks/use-work-calendar';
import { CalendarConfigPanel } from './CalendarConfigPanel';
import { WorkCalendarView } from './WorkCalendarView';
import { HolidayEditDialog } from './HolidayEditDialog';
import { holidayFormSchema, type HolidayFormValues } from '../schemas/holiday.schema';
import type { Holiday } from '../services/work-calendar.service';
import { dateToIsoDay, formatHolidayDate, isoDayToDate } from '../lib/holiday-date';

const ALL_YEARS = 'ALL';

/** Badge del origen del festivo (QL-68): automático (tertiary) vs. manual (secondary). */
function SourceBadge({ source }: { source: Holiday['source'] }) {
  return source === 'AUTO' ? (
    <Badge className="bg-tertiary-container text-on-tertiary-container">Automático</Badge>
  ) : (
    <Badge className="bg-secondary-container text-on-secondary-container">Manual</Badge>
  );
}

/**
 * Gestión de **festivos y días no laborables** (QL-10 + QL-68/QL-69 + QL-163 edición, §3.47).
 * Es el contenido del tab "Festivos" del Calendario ADMIN. Config del calendario (fines de semana,
 * festivos automáticos), calendario visual por rango, y CRUD de festivos manuales (alta, edición y
 * baja). Los festivos automáticos no se editan ni borran uno a uno (se desactivan con el toggle).
 */
export function HolidaysManager() {
  const currentYear = new Date().getFullYear();
  const [yearFilter, setYearFilter] = useState<string>(ALL_YEARS);
  const [toDelete, setToDelete] = useState<Holiday | null>(null);
  const [toEdit, setToEdit] = useState<Holiday | null>(null);

  const params = useMemo(
    () => (yearFilter === ALL_YEARS ? undefined : { year: Number(yearFilter) }),
    [yearFilter],
  );

  const { data: holidays = [], isLoading, isError, error } = useHolidays(params);
  const { data: config } = useCalendarConfig();
  const weekendDays = config?.weekendDays ?? [0, 6];
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
    formState: { errors },
  } = useForm<HolidayFormValues>({
    resolver: zodResolver(holidayFormSchema),
    defaultValues: { date: '', name: '' },
  });

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
          toast.error(err instanceof Error ? err.message : 'No se pudo añadir el festivo');
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
        setToDelete(null);
        if (err instanceof ApiError && err.code === 'AUTO_HOLIDAY_NOT_DELETABLE') {
          toast.error(
            'Los festivos automáticos no se borran: desactívalos con el toggle de festivos colombianos.',
          );
          return;
        }
        toast.error(err instanceof Error ? err.message : 'No se pudo eliminar el festivo');
      },
    });
  };

  return (
    <div className="space-y-8">
      <p className="text-sm text-on-surface-variant">
        Gestiona los días festivos. Los fines de semana ya se consideran no laborables. El sistema
        solo avisa al fijar fechas límite; no reprograma tareas.
      </p>

      {/* Configuración del calendario (fines de semana, festivos automáticos) */}
      <CalendarConfigPanel />

      {/* Calendario visual: rango de fechas, multi-mes, leyenda de 4 tipos y días laborables */}
      <WorkCalendarView weekendDays={weekendDays} />

      {/* Formulario: añadir festivo */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="grid gap-4 rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-4 sm:grid-cols-[10rem_1fr_auto] sm:items-end"
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
          {createHoliday.isPending ? <Loader2 className="animate-spin" /> : <Plus className="size-4" />}
          Añadir festivo
        </Button>
      </form>

      {/* Filtro por año */}
      <div className="flex items-center justify-between gap-4">
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
          <h3 className="text-lg font-semibold text-on-surface">Sin festivos</h3>
          <p className="mt-1 max-w-sm text-sm text-on-surface-variant">
            Añade festivos con el formulario de arriba para que el sistema avise al fijar fechas
            límite.
          </p>
        </div>
      ) : (
        <DataTableCard
          cards={holidays.map((holiday) => {
            const isAuto = holiday.source === 'AUTO';
            return (
              <DataCard key={holiday.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-on-surface">{holiday.name}</p>
                      <SourceBadge source={holiday.source} />
                    </div>
                    <p className="mt-0.5 text-sm text-on-surface-variant">
                      {formatHolidayDate(holiday.date)}
                    </p>
                  </div>
                  {!isAuto && (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-on-surface-variant"
                        onClick={() => setToEdit(holiday)}
                        aria-label={`Editar ${holiday.name}`}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-on-surface-variant hover:text-error"
                        onClick={() => setToDelete(holiday)}
                        aria-label={`Eliminar ${holiday.name}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </DataCard>
            );
          })}
        >
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {holidays.map((holiday) => {
              const isAuto = holiday.source === 'AUTO';
              return (
                <TableRow key={holiday.id}>
                  <TableCell className="font-medium text-on-surface">
                    {formatHolidayDate(holiday.date)}
                  </TableCell>
                  <TableCell className="text-on-surface">{holiday.name}</TableCell>
                  <TableCell>
                    <SourceBadge source={holiday.source} />
                  </TableCell>
                  <TableCell className="text-right">
                    {isAuto ? (
                      <span
                        className="text-xs text-on-surface-variant"
                        title="Los festivos automáticos se gestionan con el toggle de festivos colombianos."
                      >
                        Automático
                      </span>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-on-surface-variant"
                          onClick={() => setToEdit(holiday)}
                          aria-label={`Editar ${holiday.name}`}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-on-surface-variant hover:text-error"
                          onClick={() => setToDelete(holiday)}
                          aria-label={`Eliminar ${holiday.name}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </DataTableCard>
      )}

      {/* Edición de festivo manual */}
      <HolidayEditDialog
        holiday={toEdit}
        onOpenChange={(open) => {
          if (!open) setToEdit(null);
        }}
      />

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
            <AlertDialogCancel disabled={deleteHoliday.isPending}>Cancelar</AlertDialogCancel>
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
