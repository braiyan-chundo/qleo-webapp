import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { EyeOff, Loader2, Lock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/core/api/fetch-client';
import { UserSelect, type SelectedUser } from '@/features/users/components/UserSelect';
import { civilDayToDate, dateToCivilDay } from '@/shared/lib/civil-date';
import { cn } from '@/lib/utils';

import {
  useAbsenceTypes,
  useAbsencesList,
  useCreateAbsence,
  useUpdateAbsence,
} from '../hooks/use-absences';
import type { Absence, AbsenceType } from '../services/absences.service';
import { civilDaySpan, formatAbsenceDay } from '../lib/absence';
import { absenceFormSchema, type AbsenceFormValues } from '../schemas/absence.schema';

interface AbsenceFormDialogProps {
  open: boolean;
  /** Ausencia en edición; `null`/ausente = alta. */
  absence?: Absence | null;
  onOpenChange: (open: boolean) => void;
}

const emptyValues: AbsenceFormValues = {
  userId: '',
  type: '',
  from: '',
  to: '',
  note: '',
};

/** Traduce los `error.code` del contrato (§3.71 §7). El backend redacta los que llevan datos. */
function reportError(err: unknown) {
  if (err instanceof ApiError) {
    switch (err.code) {
      // Ambos llevan el detalle en el `message` (la ausencia que choca, el rango inválido).
      case 'ABSENCE_OVERLAP':
      case 'ABSENCE_RANGE_INVALID':
        toast.error(err.message);
        return;
      case 'ABSENCE_TOO_LONG':
        toast.error(
          'Una ausencia no puede durar más de 366 días. Si el periodo es más largo, regístralo por tramos (por ejemplo, año a año).',
        );
        return;
    }
    if (err.status === 404) {
      toast.error('No se encontró la persona o la ausencia.');
      return;
    }
  }
  toast.error(err instanceof Error ? err.message : 'No se pudo guardar la ausencia.');
}

/**
 * Alta/edición de una **ausencia** (QL-199, §3.71 §4). Solo Dirección: registrar la ausencia de
 * otra persona es una decisión de RRHH, no self-service.
 *
 * Tres cosas que el formulario resuelve y no son obvias:
 * - **El tipo se renderiza desde `GET /absences/types`**, con su `description` como ayuda y la
 *   marca de **tipo reservado**: quien registra tiene que saber qué va a ver el resto del equipo
 *   *antes* de guardar, no después.
 * - **`userId` no se puede editar** (§3.71 §4): mover una ausencia de una persona a otra no es una
 *   corrección, son dos hechos, y en el histórico quedaría un único `UPDATE` con el que nadie
 *   podría reconstruir que alguien estuvo marcado como ausente sin estarlo. En edición el selector
 *   sale bloqueado con el porqué.
 * - **Se enseña lo que ya existe** para esa persona en ese rango antes de guardar: dos ausencias
 *   del **mismo** tipo chocan (409), pero de **tipos distintos conviven** sin aviso del backend —
 *   es el caso real de unas vacaciones que se convierten en incapacidad a mitad.
 */
export function AbsenceFormDialog({ open, absence, onOpenChange }: AbsenceFormDialogProps) {
  const isEdit = !!absence;
  const { data: types, isLoading: typesLoading } = useAbsenceTypes({ enabled: open });

  const createAbsence = useCreateAbsence();
  const updateAbsence = useUpdateAbsence();
  const isPending = createAbsence.isPending || updateAbsence.isPending;

  const {
    control,
    handleSubmit,
    register,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AbsenceFormValues>({
    resolver: zodResolver(absenceFormSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (!open) return;
    reset(
      absence
        ? {
            userId: absence.userId,
            type: absence.type,
            from: absence.from,
            to: absence.to,
            note: absence.note ?? '',
          }
        : emptyValues,
    );
  }, [open, absence, reset]);

  const userId = watch('userId');
  const type = watch('type');
  const from = watch('from');
  const to = watch('to');

  const selectedType = useMemo(
    () => (types ?? []).find((t) => t.key === type),
    [types, type],
  );

  const days = from && to ? civilDaySpan(from, to) : null;

  /**
   * Lo que esa persona ya tiene registrado en ese rango. El listado filtra **por solape**, así que
   * basta con pasarle las mismas fechas del formulario.
   */
  const { data: existing } = useAbsencesList(
    { userId, from, to, limit: 10 },
    { enabled: open && !!userId && !!from && !!to },
  );

  const overlapping = useMemo(
    () => (existing?.data ?? []).filter((a) => a.id !== absence?.id),
    [existing, absence?.id],
  );

  /**
   * El `UserSelect` trabaja con el **objeto** y el formulario solo guarda el `userId`, así que la
   * persona elegida vive aquí: sin este estado, elegir a alguien en el alta actualizaría el
   * formulario pero el disparador seguiría mostrando el placeholder. En edición se siembra con la
   * persona de la ausencia (donde además el selector va bloqueado).
   */
  const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelectedUser(
      absence
        ? {
            id: absence.user.id,
            name: absence.user.name,
            avatarDownloadUrl: absence.user.avatarDownloadUrl,
          }
        : null,
    );
  }, [open, absence]);

  const onSubmit = (values: AbsenceFormValues) => {
    // Días civiles literales: nunca `new Date(...).toISOString()`.
    const note = values.note?.trim() ?? '';

    if (isEdit && absence) {
      updateAbsence.mutate(
        {
          id: absence.id,
          dto: {
            type: values.type as AbsenceType,
            from: values.from,
            to: values.to,
            // `null` explícito borra la nota; omitirlo no la tocaría.
            note: note || null,
          },
        },
        {
          onSuccess: () => {
            toast.success('Ausencia actualizada.');
            onOpenChange(false);
          },
          onError: reportError,
        },
      );
      return;
    }

    createAbsence.mutate(
      {
        userId: values.userId,
        type: values.type as AbsenceType,
        from: values.from,
        to: values.to,
        ...(note ? { note } : {}),
      },
      {
        onSuccess: () => {
          toast.success('Ausencia registrada.');
          onOpenChange(false);
        },
        onError: reportError,
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar ausencia' : 'Nueva ausencia'}</DialogTitle>
          <DialogDescription>
            Registrar la ausencia no bloquea nada: Qleo <strong>avisa</strong> al asignar tareas a
            esa persona, pero deja continuar.
          </DialogDescription>
        </DialogHeader>

        <form id="absence-form" onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label className="text-on-surface">
              Persona <span className="text-error">*</span>
            </Label>
            <Controller
              control={control}
              name="userId"
              render={({ field }) => (
                <UserSelect
                  value={selectedUser}
                  onChange={(user) => {
                    setSelectedUser(user);
                    field.onChange(user.id);
                  }}
                  disabled={isEdit || isPending}
                  className="w-full"
                  placeholder="Elegir persona…"
                />
              )}
            />
            {isEdit ? (
              <span className="inline-flex items-start gap-1.5 text-xs text-on-surface-variant">
                <Lock className="mt-0.5 size-3 shrink-0" aria-hidden />
                La persona no se puede cambiar: sería otro hecho, no una corrección. Para
                moverla, borra esta ausencia y crea una nueva.
              </span>
            ) : (
              errors.userId && (
                <span className="text-xs font-medium text-error">{errors.userId.message}</span>
              )
            )}
          </div>

          {/* Tipo renderizado DESDE el catálogo del backend; textos tal cual. */}
          <div className="grid gap-1.5">
            <Label htmlFor="absence-type" className="text-on-surface">
              Tipo <span className="text-error">*</span>
            </Label>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <NativeSelect
                  id="absence-type"
                  className="w-full [&>select]:h-10"
                  value={field.value}
                  disabled={typesLoading || isPending}
                  onChange={(e) => field.onChange(e.target.value)}
                >
                  <NativeSelectOption value="" disabled>
                    {typesLoading ? 'Cargando tipos…' : 'Elegir tipo'}
                  </NativeSelectOption>
                  {(types ?? []).map((item) => (
                    <NativeSelectOption key={item.key} value={item.key}>
                      {item.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
            />
            {errors.type && (
              <span className="text-xs font-medium text-error">{errors.type.message}</span>
            )}

            {/* La `description` del catálogo dice qué verá el resto del equipo. Es lo que hay que
                saber ANTES de guardar, así que se pinta junto al selector y no en un tooltip. */}
            {selectedType && (
              <p
                className={cn(
                  'inline-flex items-start gap-1.5 rounded-md px-2.5 py-2 text-xs',
                  selectedType.sensitive
                    ? 'border border-outline-variant/60 bg-surface-container text-on-surface-variant'
                    : 'text-on-surface-variant',
                )}
              >
                {selectedType.sensitive && (
                  <EyeOff className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                )}
                <span>{selectedType.description}</span>
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="absence-from" className="text-on-surface">
                Desde <span className="text-error">*</span>
              </Label>
              <Controller
                control={control}
                name="from"
                render={({ field }) => (
                  <DatePicker
                    id="absence-from"
                    className="w-full"
                    value={civilDayToDate(field.value)}
                    onChange={(date) => {
                      const next = dateToCivilDay(date);
                      field.onChange(next);
                      // Elegir un inicio posterior al fin dejaría un rango imposible en pantalla.
                      if (next && to && next > to) setValue('to', next);
                    }}
                  />
                )}
              />
              {errors.from && (
                <span className="text-xs font-medium text-error">{errors.from.message}</span>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="absence-to" className="text-on-surface">
                Hasta <span className="text-error">*</span>
              </Label>
              <Controller
                control={control}
                name="to"
                render={({ field }) => (
                  <DatePicker
                    id="absence-to"
                    className="w-full"
                    value={civilDayToDate(field.value)}
                    onChange={(date) => field.onChange(dateToCivilDay(date))}
                  />
                )}
              />
              {errors.to && (
                <span className="text-xs font-medium text-error">{errors.to.message}</span>
              )}
            </div>
          </div>

          {/*
            `to` es INCLUSIVO: decirlo evita el clásico "del 10 al 10 son 0 días". La **fecha de
            regreso** no se calcula aquí — el backend la encadena con las ausencias consecutivas y
            la devuelve en `returnsOn`; un `to + 1` a mano diría "vuelve el 21" cuando la persona
            vuelve el 26. Por eso solo se muestra la guardada, en edición.
          */}
          {days !== null && days > 0 && (
            <p className="text-xs text-on-surface-variant">
              {days === 1 ? '1 día de ausencia' : `${days} días de ausencia`}, contando los dos
              extremos.
              {isEdit && absence && absence.from === from && absence.to === to
                ? ` Vuelve el ${formatAbsenceDay(absence.returnsOn)}.`
                : ''}
            </p>
          )}

          {/* (§3.71 §6) Lo que ya existe en ese rango. Mismo tipo → 409; tipos distintos conviven
              sin que el backend diga nada, así que la única forma de verlo es enseñarlo. */}
          {overlapping.length > 0 && (
            <div className="grid gap-1.5 rounded-lg border border-outline-variant/60 bg-surface-container-low px-3 py-2.5">
              <span className="text-xs font-medium text-on-surface">
                Esta persona ya tiene algo registrado en esas fechas
              </span>
              <ul className="grid gap-0.5">
                {overlapping.map((item) => (
                  <li key={item.id} className="text-xs text-on-surface-variant">
                    {item.typeLabel}: {formatAbsenceDay(item.from)} –{' '}
                    {formatAbsenceDay(item.to)}
                  </li>
                ))}
              </ul>
              <span className="text-xs text-on-surface-variant">
                Otro periodo del <strong>mismo tipo</strong> se rechazará. De un tipo distinto se
                permite (unas vacaciones que se convierten en incapacidad, por ejemplo).
              </span>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="absence-note" className="text-on-surface">
              Nota interna
            </Label>
            <Textarea
              id="absence-note"
              rows={2}
              maxLength={500}
              placeholder="Motivo, nº de incapacidad, quién lo autorizó…"
              {...register('note')}
            />
            {/* La nota NO sale por ningún canal abierto: ni al equipo, ni a la propia persona. */}
            <span className="inline-flex items-start gap-1.5 text-xs text-on-surface-variant">
              <Lock className="mt-0.5 size-3 shrink-0" aria-hidden />
              Solo la ve Dirección en esta pantalla. No se muestra en el calendario, ni en los
              avisos, ni a la propia persona.
            </span>
            {errors.note && (
              <span className="text-xs font-medium text-error">{errors.note.message}</span>
            )}
          </div>
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button type="submit" form="absence-form" disabled={isPending}>
            {isPending && <Loader2 className="animate-spin" />}
            {isEdit ? 'Guardar cambios' : 'Registrar ausencia'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
