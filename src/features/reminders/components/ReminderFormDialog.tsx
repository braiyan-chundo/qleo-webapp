import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Globe, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useIsMobile } from '@/hooks/use-mobile';
import { useDebounce } from '@/shared/hooks/use-debounce';
import { cn } from '@/lib/utils';

import type {
  PreviewReminderDto,
  ReminderKind,
  ReminderResponseDto,
  ReminderTaskRef,
} from '../types/reminder.types';
import { useCreateReminder, useReminderPreview, useUpdateReminder } from '../hooks/use-reminders';
import { bogotaToday, formatNextFire, isCivilPast } from '../lib/bogota-time';
import {
  anySkippedOutsideHours,
  KIND_LABELS,
  KIND_ORDER,
  MESSAGE_MAX_LENGTH,
  reminderGroup,
  skipForSlot,
  skipsOutsideHoursAt,
} from '../lib/reminder-display';
import { isNetworkError, reminderErrorCode, REMINDER_ERROR_TEXT } from '../lib/reminder-errors';
import { KIND_ICONS } from '../lib/reminder-icons';
import {
  buildReminderFormSchema,
  EMPTY_CONTEXT,
  emptyReminderValues,
  lastEligibleDay,
  MESSAGES,
  reminderToForm,
  toCreateDto,
  toPreviewBody,
  toUpdateDto,
  type ReminderFormValues,
} from '../schemas/reminder-form.schema';
import { ReminderPreview } from './ReminderPreview';
import { ReminderScheduleFields, FieldError, type ScheduleWarnings } from './ReminderScheduleFields';
import { ReminderStatePill, StatePill } from './ReminderStatePill';
import { ReminderTaskPicker, type PickedTask } from './ReminderTaskPicker';
import { TOGGLE_ITEM_CLASS } from './WeekdayToggles';

interface ReminderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Recordatorio en edición; `null`/ausente = alta. Se pasa fresco desde la caché. */
  reminder?: ReminderResponseDto | null;
  /** Desde la vista de tarea: la tarea va fija y no se ofrece el selector (AC-18). */
  fixedTask?: ReminderTaskRef | null;
}

const DESCRIPTION = 'Solo tú lo ves. Te avisa con una notificación a la hora exacta.';

/**
 * Alta y edición de un **recordatorio** (HU-0202, DS-1): `Dialog` desde 768 px y `Drawer` inferior
 * en el teléfono, con el pie fijo. Mensaje → tarea → cuándo (hora de Bogotá) → tipo → campos → dos
 * casillas → vista previa. Las advertencias salen de la vista previa y nunca deshabilitan Guardar.
 */
export function ReminderFormDialog({ open, onOpenChange, reminder, fixedTask }: ReminderFormDialogProps) {
  const isMobile = useIsMobile();
  const title = reminder ? 'Editar recordatorio' : 'Nuevo recordatorio';
  // El cuerpo vive dentro del contenido, que se monta al abrir: cada apertura parte de cero.
  const body = (variant: 'dialog' | 'drawer') => (
    <ReminderFormBody
      variant={variant}
      reminder={reminder ?? null}
      fixedTask={fixedTask ?? null}
      title={title}
      onClose={() => onOpenChange(false)}
    />
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="data-[vaul-drawer-direction=bottom]:max-h-[94dvh]">
          {body('drawer')}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-lg">
        {body('dialog')}
      </DialogContent>
    </Dialog>
  );
}

interface ReminderFormBodyProps {
  variant: 'dialog' | 'drawer';
  reminder: ReminderResponseDto | null;
  fixedTask: ReminderTaskRef | null;
  title: string;
  onClose: () => void;
}

function initialPickedTask(
  reminder: ReminderResponseDto | null,
  fixedTask: ReminderTaskRef | null,
): PickedTask | null {
  if (fixedTask) return { id: fixedTask.id, title: fixedTask.title };
  if (!reminder?.taskId) return null;
  return {
    id: reminder.taskId,
    // Sin acceso: `task: null` y no se revela el título (AC-23).
    title: reminder.task?.title ?? null,
    completed: reminder.blockedReason === 'TASK_COMPLETED',
  };
}

function ReminderFormBody({ variant, reminder, fixedTask, title, onClose }: ReminderFormBodyProps) {
  const isEdit = reminder !== null;
  // Solo al abrir: los valores del formulario no se pisan si el recordatorio se relee.
  const [initial] = useState(() => (reminder ? reminderToForm(reminder) : null));
  // El contexto (pares guardados) sí sigue al recordatorio fresco: tras un 409 se compara con lo
  // que hay ahora en el servidor.
  const context = useMemo(
    () => (reminder ? reminderToForm(reminder).context : EMPTY_CONTEXT),
    [reminder],
  );
  const schema = useMemo(() => buildReminderFormSchema(context), [context]);

  const createReminder = useCreateReminder();
  const updateReminder = useUpdateReminder();
  const saving = createReminder.isPending || updateReminder.isPending;

  const [pickedTask, setPickedTask] = useState<PickedTask | null>(() =>
    initialPickedTask(reminder, fixedTask),
  );

  const {
    control,
    register,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    watch,
    formState: { errors },
  } = useForm<ReminderFormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial?.values ?? emptyReminderValues(fixedTask?.id ?? null),
  });

  const values = watch();
  const kind = values.kind;
  const messageLength = values.message?.trim().length ?? 0;

  // Vista previa con rebote (~400 ms) sobre una clave estable: el objeto se recrea en cada render.
  const previewBody = toPreviewBody(values, context);
  const previewKey = previewBody ? JSON.stringify(previewBody) : '';
  const debouncedKey = useDebounce(previewKey, 400);
  const debouncedBody = useMemo(
    () => (debouncedKey ? (JSON.parse(debouncedKey) as PreviewReminderDto) : null),
    [debouncedKey],
  );
  const preview = useReminderPreview(debouncedBody);
  const previewCurrent =
    !!previewBody && debouncedKey === previewKey && !preview.isPlaceholderData && !!preview.data;
  const occurrences = previewCurrent ? (preview.data?.occurrences ?? []) : [];

  const warnings: ScheduleWarnings = {
    once: kind === 'ONCE' ? (occurrences[0]?.skipped ?? null) : null,
    hour: (kind === 'DAILY' || kind === 'WEEKLY') && anySkippedOutsideHours(occurrences),
    slots:
      kind === 'DATES'
        ? (values.slots ?? []).map((slot) =>
            slot.date && slot.time ? skipForSlot(occurrences, slot.date, slot.time) : null,
          )
        : [],
    intervalStart:
      kind === 'INTERVAL' && !!values.startTime && skipsOutsideHoursAt(occurrences, values.startTime),
    intervalEnd:
      kind === 'INTERVAL' && !!values.endTime && skipsOutsideHoursAt(occurrences, values.endTime),
  };

  const today = bogotaToday();
  const maxDay = lastEligibleDay();

  /** Señala junto al par vencido un `REMINDER_IN_PAST` del servidor (§3.74 §4). */
  const markPastPairs = (submitted: ReminderFormValues) => {
    if (submitted.kind === 'ONCE') {
      setError('onceTime', { message: MESSAGES.inPast }, { shouldFocus: true });
      return;
    }
    let marked = false;
    submitted.slots.forEach((slot, index) => {
      if (slot.date && slot.time && isCivilPast(slot.date, slot.time)) {
        setError(`slots.${index}.time`, { message: MESSAGES.inPast }, { shouldFocus: !marked });
        marked = true;
      }
    });
    if (!marked) toast.error(MESSAGES.inPast);
  };

  const reportSaveError = (error: unknown, submitted: ReminderFormValues) => {
    if (isNetworkError(error)) {
      toast.error(REMINDER_ERROR_TEXT.offlineSave);
      return;
    }
    switch (reminderErrorCode(error)) {
      case 'REMINDER_IN_PAST':
        markPastPairs(submitted);
        return;
      case 'REMINDER_TASK_NOT_FOUND':
        setError('taskId', { message: REMINDER_ERROR_TEXT.taskNotFound });
        document.getElementById('reminder-task')?.focus();
        return;
      case 'REMINDER_LIMIT_REACHED':
        toast.error(REMINDER_ERROR_TEXT.limitReached);
        return;
      case 'REMINDER_SCHEDULE_INVALID':
        toast.error(REMINDER_ERROR_TEXT.scheduleInvalid);
        return;
      case 'REMINDER_NOT_FOUND':
        toast.error(REMINDER_ERROR_TEXT.notFound);
        onClose();
        return;
      case 'REMINDER_CONFLICT':
        // La mutación ya invalidó la lista: se relee y la persona vuelve a guardar.
        toast.error(REMINDER_ERROR_TEXT.conflict);
        return;
      default:
        toast.error(REMINDER_ERROR_TEXT.genericSave);
    }
  };

  const onSubmit = (submitted: ReminderFormValues) => {
    if (reminder) {
      const dto = toUpdateDto(submitted, context, reminder);
      if (Object.keys(dto).length === 0) {
        onClose();
        return;
      }
      updateReminder.mutate(
        { id: reminder.id, dto },
        { onSuccess: onClose, onError: (error) => reportSaveError(error, submitted) },
      );
      return;
    }
    createReminder.mutate(toCreateDto(submitted, context), {
      onSuccess: onClose,
      onError: (error) => reportSaveError(error, submitted),
    });
  };

  const Title = variant === 'dialog' ? DialogTitle : DrawerTitle;
  const Description = variant === 'dialog' ? DialogDescription : DrawerDescription;

  const statusLine = reminder ? <ReminderStatusLine reminder={reminder} /> : null;

  const header = (
    <>
      <Title className="font-heading text-lg font-semibold text-on-surface">{title}</Title>
      <Description className="text-on-surface-variant">{DESCRIPTION}</Description>
      {statusLine}
    </>
  );

  const fields = (
    <form
      id="reminder-form"
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className={cn(
        'grid min-h-0 flex-1 content-start gap-5 overflow-y-auto',
        variant === 'dialog' ? 'px-6 py-5' : 'px-4 py-4',
      )}
    >
      {/* Mensaje */}
      <div className="grid gap-1.5">
        <Label htmlFor="reminder-message" className="w-full text-on-surface">
          Mensaje <span className="text-error">*</span>
          <span
            className={cn(
              'ml-auto text-xs font-normal tabular-nums text-on-surface-variant',
              messageLength > MESSAGE_MAX_LENGTH && 'font-semibold text-error',
            )}
          >
            {messageLength}/{MESSAGE_MAX_LENGTH}
          </span>
        </Label>
        <Textarea
          id="reminder-message"
          rows={2}
          placeholder="Ej.: Llamar a Avianca para confirmar el bloqueo de sillas"
          aria-invalid={!!errors.message || undefined}
          disabled={saving}
          {...register('message')}
        />
        <FieldError>{errors.message?.message}</FieldError>
      </div>

      {/* Tarea */}
      <div className="grid gap-1.5">
        <Label htmlFor="reminder-task" className="text-on-surface">
          Tarea
          {!fixedTask && <span className="font-normal text-on-surface-variant">(opcional)</span>}
        </Label>
        <ReminderTaskPicker
          id="reminder-task"
          value={pickedTask}
          fixed={!!fixedTask}
          invalid={!!errors.taskId}
          disabled={saving}
          onChange={(task) => {
            setPickedTask(task);
            setValue('taskId', task?.id ?? null, { shouldDirty: true });
            clearErrors('taskId');
          }}
        />
        <FieldError>{errors.taskId?.message}</FieldError>
      </div>

      {/* Cuándo */}
      <div className="grid gap-1.5">
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-on-surface">
          Cuándo
          <span className="inline-flex items-center gap-1 text-xs font-medium text-on-surface-variant">
            <Globe className="size-3" aria-hidden />
            Hora de Bogotá
          </span>
        </p>
        <Controller
          control={control}
          name="kind"
          render={({ field }) => (
            <ToggleGroup
              type="single"
              role="radiogroup"
              aria-label="Repetición"
              value={field.value}
              onValueChange={(next) => {
                // Un grupo «single» deja desmarcar; aquí siempre hay un tipo elegido.
                if (next) field.onChange(next as ReminderKind);
              }}
              disabled={saving}
              className="flex-wrap"
              spacing={1.5}
            >
              {KIND_ORDER.map((k) => {
                const Icon = KIND_ICONS[k];
                return (
                  <ToggleGroupItem key={k} value={k} className={TOGGLE_ITEM_CLASS}>
                    <Icon aria-hidden />
                    {KIND_LABELS[k]}
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
          )}
        />
      </div>

      <ReminderScheduleFields
        kind={kind}
        control={control}
        register={register}
        errors={errors}
        warnings={warnings}
        resolvedSlots={context.resolvedSlots}
        today={today}
        maxDay={maxDay}
        disabled={saving}
      />

      {/* Las dos casillas, independientes y desmarcadas por defecto (D-21, D-22, AC-30). */}
      <div className="grid gap-3.5">
        <Controller
          control={control}
          name="soundOnNonWorkingDays"
          render={({ field }) => (
            <CheckRow
              id="reminder-non-working"
              checked={field.value}
              onChange={field.onChange}
              disabled={saving}
              label="Sonar también en vacaciones, festivos y días no laborales"
              help="Si no la marcas, el aviso de esos días se omite; no se mueve a otro día."
            />
          )}
        />
        <Controller
          control={control}
          name="soundOutsideWorkingHours"
          render={({ field }) => (
            <CheckRow
              id="reminder-outside-hours"
              checked={field.value}
              onChange={field.onChange}
              disabled={saving}
              label="Sonar también fuera del horario laboral"
              help="Si no la marcas, el aviso que cae fuera de tu jornada se omite; no se mueve a otra hora."
            />
          )}
        />
      </div>

      <ReminderPreview
        kind={kind}
        data={previewBody ? preview.data : undefined}
        incomplete={!previewBody}
        loading={!!previewBody && (preview.isFetching || debouncedKey !== previewKey)}
        failed={preview.isError}
        editing={isEdit}
      />
    </form>
  );

  const footerButtons = (
    <>
      <Button
        type="button"
        variant="outline"
        className={cn('h-10', variant === 'drawer' && 'h-11 flex-1')}
        onClick={onClose}
        disabled={saving}
      >
        Cancelar
      </Button>
      <Button
        type="submit"
        form="reminder-form"
        className={cn('h-10', variant === 'drawer' && 'h-11 flex-1')}
        disabled={saving}
      >
        {saving && <Loader2 className="animate-spin" />}
        {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear recordatorio'}
      </Button>
    </>
  );

  if (variant === 'drawer') {
    return (
      <>
        <DrawerHeader className="gap-1 px-4 pt-3 pb-0 text-left group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left">{header}</DrawerHeader>
        {fields}
        <DrawerFooter className="mt-0 flex-row gap-2 border-t border-outline-variant/50 px-4 pt-3 pb-4">
          {footerButtons}
        </DrawerFooter>
      </>
    );
  }

  return (
    <>
      <DialogHeader className="gap-1.5 px-6 pt-6 pr-12">{header}</DialogHeader>
      {fields}
      <DialogFooter className="mx-0 mb-0 border-outline-variant/50 bg-popover px-6 py-4">
        {footerButtons}
      </DialogFooter>
    </>
  );
}

interface CheckRowProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  help: string;
  disabled?: boolean;
}

function CheckRow({ id, checked, onChange, label, help, disabled }: CheckRowProps) {
  return (
    <div className="flex items-start gap-2.5 max-md:min-h-11">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
        disabled={disabled}
        className="mt-0.5"
      />
      <Label htmlFor={id} className="grid gap-0.5 leading-snug">
        <span className="text-sm font-medium text-on-surface">{label}</span>
        <span className="text-xs font-normal text-on-surface-variant">{help}</span>
      </Label>
    </div>
  );
}

/** Editar: estado y «Próximo» bajo la descripción (maqueta). */
function ReminderStatusLine({ reminder }: { reminder: ReminderResponseDto }) {
  const group = reminderGroup(reminder);
  return (
    <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-on-surface-variant">
      {group === 'active' ? (
        <>
          <StatePill tone="primary">Activo</StatePill>
          <span className="tabular-nums">
            {reminder.nextFireAt ? `Próximo: ${formatNextFire(reminder.nextFireAt)}` : 'Sin próximo aviso'}
          </span>
        </>
      ) : (
        <>
          <ReminderStatePill reminder={reminder} />
          {group === 'done' && <span>Ponle una fecha futura para volver a activarlo.</span>}
        </>
      )}
    </div>
  );
}
