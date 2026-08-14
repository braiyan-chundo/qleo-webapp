import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { CalendarClock, Loader2, Lock, LockOpen, Send, TriangleAlert } from 'lucide-react';

import { ApiError } from '@/core/api/fetch-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

import { useCheckDate } from '@/features/work-calendar/hooks/use-work-calendar';
import { useAuthStore } from '@/store/auth.store';

import { DatePicker } from '@/components/ui/date-picker';

import { useRequestDeadlineExtension, useSetDeadline } from '../hooks/use-tasks';
import {
  deadlineExtensionSchema,
  type DeadlineExtensionValues,
} from '../schemas/task.schema';
import type { Task } from '../services/tasks.service';
import {
  DEFAULT_DEADLINE_TIME,
  dateInputToDate,
  dateTimeInputToIso,
  dateToDateInput,
  formatDueDate,
  isoToDateInput,
  isoToTimeInput,
  isOverdue,
} from '../lib/deadline';
import { effectiveTaskRole } from '../lib/roles';
import { isOpenEndedBlocked, taskDateErrorMessage } from '../lib/open-ended';

interface DeadlineSectionProps {
  task: Task;
  projectId: string;
}

/**
 * Sección "Fecha límite" del detalle de tarea (QL-09, RF-2.1). El gating depende del rol
 * **efectivo** del usuario (QL-192: un Creador autoasignado manda como CREATOR, no como
 * ASSIGNEE) y de `task.deadlineLocked`:
 * - CREATOR: edita la fecha y togglea el bloqueo.
 * - ASSIGNEE/COLLABORATOR: editan la fecha si NO está bloqueada; si lo está, ven aviso y el
 *   botón "Solicitar prórroga".
 * - OBSERVER / no participante: solo lectura.
 */
export function DeadlineSection({ task, projectId }: DeadlineSectionProps) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const role = effectiveTaskRole(task, currentUserId);
  const isCreator = role === 'CREATOR';
  const canEditRole = role === 'ASSIGNEE' || role === 'COLLABORATOR';
  const canRequestExtension = task.deadlineLocked && canEditRole;

  const setDeadline = useSetDeadline(projectId, task.id);

  const [dateValue, setDateValue] = useState(isoToDateInput(task.dueDate));
  // (QL-166) Hora del deadline. Precarga la hora real de la `dueDate` existente; si no hay
  // fecha, arranca en el default de fin de jornada (18:00) como valor listo para usar.
  const [timeValue, setTimeValue] = useState(
    isoToTimeInput(task.dueDate) || DEFAULT_DEADLINE_TIME,
  );
  const [showExtension, setShowExtension] = useState(false);

  // Re-sincroniza los inputs cuando cambian los datos de la tarea (p. ej. tras guardar).
  useEffect(() => {
    setDateValue(isoToDateInput(task.dueDate));
    setTimeValue(isoToTimeInput(task.dueDate) || DEFAULT_DEADLINE_TIME);
  }, [task.dueDate]);

  const overdue = isOverdue(task.dueDate);
  const editorDisabled = !isCreator && (!canEditRole || task.deadlineLocked);
  // (QL-197) Bloqueada por su fin abierto. NO deshabilita este editor a propósito: ponerle una
  // fecha es justamente la vía de escape, y tiene que seguir disponible sobre todo tras un
  // rechazo. Solo se usa para explicarlo.
  const openEndedBlocked = isOpenEndedBlocked(task);
  // (QL-166) "Sucio" si cambió el día o —habiendo un día elegido— cambió la hora respecto a
  // la guardada. Con la fecha vacía, la hora sola no cuenta (sin fecha no hay deadline).
  const savedDate = isoToDateInput(task.dueDate);
  const savedTime = task.dueDate ? isoToTimeInput(task.dueDate) : DEFAULT_DEADLINE_TIME;
  const dirty = dateValue !== savedDate || (!!dateValue && timeValue !== savedTime);

  // QL-10 (RF-2.2): aviso NO bloqueante de día no laborable. Evalúa la fecha elegida en el
  // editor o, en su defecto, la `dueDate` ya guardada. El backend avisa, no reprograma.
  const checkDate = dateValue || isoToDateInput(task.dueDate);
  const { data: workCheck } = useCheckDate(checkDate, { enabled: !!checkDate });
  const showNonWorkingWarning = !!checkDate && workCheck?.isWorkingDay === false;

  const handleSave = () => {
    setDeadline.mutate(
      { dueDate: dateTimeInputToIso(dateValue, timeValue) },
      {
        onSuccess: () => toast.success('Fecha límite actualizada'),
        onError: (err) => handleDeadlineError(err),
      },
    );
  };

  // (QL-197) Ya no existe un `handleClear`: `PATCH /tasks/:id/deadline { dueDate: null }` sobre
  // una tarea que tiene fecha responde 400 `TASK_DUE_DATE_REQUIRED` salvo con el fin abierto
  // APPROVED —y esa combinación no puede darse, porque poner fecha cancela la autorización—.
  // Para dejar una tarea sin fecha de fin hay que pedirle autorización a Dirección en el alta.

  const handleToggleLock = (locked: boolean) => {
    setDeadline.mutate(
      { locked },
      {
        onSuccess: () =>
          toast.success(locked ? 'Edición de la fecha bloqueada' : 'Edición desbloqueada'),
        onError: (err) => handleDeadlineError(err),
      },
    );
  };

  return (
    <section className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-on-surface-variant">
          <CalendarClock className="size-3.5" />
          Fecha límite
        </p>
        {task.deadlineLocked && (
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-high px-2 py-0.5 text-xs font-medium text-on-surface-variant">
            <Lock className="size-3" />
            Bloqueada
          </span>
        )}
      </div>

      <p className="mt-1 flex items-center gap-2 text-sm text-on-surface">
        {task.dueDate ? (
          <>
            <span className="font-medium">{formatDueDate(task.dueDate)}</span>
            {overdue && (
              <span className="inline-flex items-center gap-1 rounded-full bg-error-container px-2 py-0.5 text-xs font-medium text-on-error-container">
                <TriangleAlert className="size-3" />
                Vencida
              </span>
            )}
          </>
        ) : (
          // (QL-197) `dueDate: null` ya no significa una sola cosa: en el histórico es "nadie le
          // puso fecha", y con una solicitud es un estado con nombre propio. El detalle vive en
          // `OpenEndedSection`; aquí solo se evita el texto que dice lo que no es.
          <span className="text-on-surface-variant">
            {task.openEndedStatus === 'APPROVED'
              ? 'Sin fecha de fin (autorizado por Dirección).'
              : task.openEndedStatus
                ? 'Sin fecha de fin: hay una solicitud de autorización en curso.'
                : 'Sin fecha límite.'}
          </span>
        )}
      </p>

      {/* (QL-197) La vía de escape del bloqueo, dicha donde está el editor: ponerle una fecha
          cancela la solicitud entera en el backend y desbloquea la tarea. */}
      {openEndedBlocked && (isCreator || canEditRole) && (
        <p className="mt-2 rounded-md bg-surface-container-high px-3 py-2 text-xs text-on-surface-variant">
          La tarea está bloqueada por su solicitud de fin abierto. Al guardar una fecha de
          finalización, la solicitud se cancela y la tarea se desbloquea.
        </p>
      )}

      {/* Editor: CREATOR siempre; ASSIGNEE/COLLABORATOR solo si no está bloqueada. */}
      {(isCreator || canEditRole) && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="grid gap-1.5">
            <Label htmlFor="dueDate" className="text-xs text-on-surface-variant">
              {isCreator ? 'Fijar / cambiar fecha' : 'Cambiar fecha'}
            </Label>
            <DatePicker
              id="dueDate"
              className="w-44"
              value={dateInputToDate(dateValue)}
              disabled={editorDisabled || setDeadline.isPending}
              onChange={(date) => setDateValue(dateToDateInput(date))}
              placeholder="Elegir fecha"
            />
          </div>
          {/* (QL-166) Hora del deadline. Por defecto 18:00 (fin de jornada) si se elige una
              fecha sin tocar la hora. */}
          <div className="grid gap-1.5">
            <Label htmlFor="dueTime" className="text-xs text-on-surface-variant">
              Hora
            </Label>
            <Input
              id="dueTime"
              type="time"
              className="w-32"
              value={timeValue}
              disabled={editorDisabled || setDeadline.isPending}
              onChange={(e) => setTimeValue(e.target.value)}
            />
          </div>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={editorDisabled || setDeadline.isPending || !dirty}
          >
            {setDeadline.isPending && <Loader2 className="animate-spin" />}
            Guardar
          </Button>
          {/* (QL-197) El botón "Quitar" desapareció, no se deshabilitó: desde esta HU **quitar
              una fecha de fin existente siempre falla** con 400 `TASK_DUE_DATE_REQUIRED` — la
              única excepción del backend es que el fin abierto esté `APPROVED`, y una tarea
              aprobada nunca tiene fecha (ponerle una cancela la autorización). Dejarlo visible
              era ofrecer una acción que la API rechaza el 100% de las veces. */}
        </div>
      )}

      {/* Aviso de día no laborable (QL-10, RF-2.2). No bloquea; solo sugiere. El botón de
          autocompletar aparece solo si el usuario puede editar la fecha. */}
      {showNonWorkingWarning && workCheck && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-tertiary-container/60 px-3 py-2 text-xs text-on-tertiary-container">
          <span className="inline-flex items-center gap-1.5">
            <TriangleAlert className="size-3.5 shrink-0" />
            Esa fecha cae en {reasonLabel(workCheck.reason)}.{' '}
            {workCheck.nextWorkingDay !== workCheck.date && (
              <>¿Prefieres el {formatIsoDay(workCheck.nextWorkingDay)}?</>
            )}
          </span>
          {!editorDisabled && workCheck.nextWorkingDay !== workCheck.date && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs text-on-tertiary-container hover:bg-tertiary-container"
              onClick={() => setDateValue(workCheck.nextWorkingDay)}
            >
              Usar {formatIsoDay(workCheck.nextWorkingDay)}
            </Button>
          )}
        </div>
      )}

      {/* Aviso de bloqueo para no-Creadores. */}
      {canEditRole && task.deadlineLocked && (
        <p className="mt-2 text-xs text-on-surface-variant">
          El Creador bloqueó la fecha. Puedes solicitarle una prórroga.
        </p>
      )}

      {/* CREATOR: toggle de bloqueo. */}
      {isCreator && (
        <label className="mt-3 flex items-center gap-2 text-sm text-on-surface">
          <Switch
            checked={task.deadlineLocked}
            disabled={setDeadline.isPending}
            onCheckedChange={handleToggleLock}
          />
          <span className="inline-flex items-center gap-1.5">
            {task.deadlineLocked ? (
              <Lock className="size-3.5 text-on-surface-variant" />
            ) : (
              <LockOpen className="size-3.5 text-on-surface-variant" />
            )}
            Bloquear edición para Responsable y Colaboradores
          </span>
        </label>
      )}

      {/* Solicitud de prórroga (ASSIGNEE/COLLABORATOR con fecha bloqueada). */}
      {canRequestExtension && (
        <div className="mt-3">
          {showExtension ? (
            <ExtensionRequestForm
              task={task}
              onCancel={() => setShowExtension(false)}
              onDone={() => setShowExtension(false)}
            />
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowExtension(true)}
            >
              <Send className="size-3.5" />
              Solicitar prórroga
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

/** Traduce el motivo de no-laborable (QL-10) a texto en español para el aviso. */
function reasonLabel(reason: 'WEEKEND' | 'HOLIDAY' | null): string {
  if (reason === 'HOLIDAY') return 'un día festivo';
  return 'fin de semana';
}

/** Formatea un `YYYY-MM-DD` a fecha legible en español (ej. "6 jul 2026"). */
function formatIsoDay(isoDay: string): string {
  const [year, month, day] = isoDay.split('-').map(Number);
  if (!year || !month || !day) return isoDay;
  return new Date(year, month - 1, day).toLocaleDateString('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Traduce los `error.code` del endpoint de deadline a toasts claros en español. */
function handleDeadlineError(err: unknown) {
  // (QL-197) `TASK_DUE_DATE_REQUIRED` al intentar QUITAR una fecha que la tarea ya tiene: solo
  // se permite si Dirección autorizó el fin abierto. Mismo mapa que el formulario y el detalle.
  const dateMessage = taskDateErrorMessage(err);
  if (dateMessage) {
    toast.error(dateMessage);
    return;
  }
  if (err instanceof ApiError) {
    if (err.code === 'DEADLINE_LOCKED') {
      toast.error('El Creador bloqueó la fecha. Solicita una prórroga.');
      return;
    }
    if (err.code === 'READ_ONLY_ROLE') {
      toast.error('Como Observador no puedes cambiar la fecha.');
      return;
    }
  }
  toast.error(err instanceof Error ? err.message : 'No se pudo actualizar la fecha límite');
}

interface ExtensionRequestFormProps {
  task: Task;
  onCancel: () => void;
  onDone: () => void;
}

/** Formulario compacto (rhf+zod) para pedir una prórroga: fecha propuesta + motivo. */
function ExtensionRequestForm({ task, onCancel, onDone }: ExtensionRequestFormProps) {
  const requestExtension = useRequestDeadlineExtension(task.id);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<DeadlineExtensionValues>({
    resolver: zodResolver(deadlineExtensionSchema),
    defaultValues: {
      requestedDate: isoToDateInput(task.dueDate),
      // (QL-166) Precarga la hora real del deadline vigente; sin fecha, el fin de jornada.
      requestedTime: isoToTimeInput(task.dueDate) || DEFAULT_DEADLINE_TIME,
      reason: '',
    },
  });

  const onSubmit = (values: DeadlineExtensionValues) => {
    const requestedDate = dateTimeInputToIso(values.requestedDate, values.requestedTime);
    if (!requestedDate) return;
    requestExtension.mutate(
      { requestedDate, reason: values.reason.trim() },
      {
        onSuccess: () => {
          toast.success('Solicitud de prórroga enviada al Creador');
          onDone();
        },
        onError: (err) => {
          if (err instanceof ApiError && err.code === 'READ_ONLY_ROLE') {
            toast.error('Como Observador no puedes solicitar prórroga.');
            return;
          }
          toast.error(
            err instanceof Error ? err.message : 'No se pudo enviar la solicitud',
          );
        },
      },
    );
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="grid gap-3 rounded-lg border border-outline-variant/40 bg-surface-container-low px-3 py-3"
    >
      <p className="text-xs font-medium text-on-surface">Solicitar prórroga al Creador</p>

      <div className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1.5">
          <Label htmlFor="requestedDate" className="text-xs text-on-surface-variant">
            Nueva fecha propuesta <span className="text-error">*</span>
          </Label>
          <Controller
            control={control}
            name="requestedDate"
            render={({ field }) => (
              <DatePicker
                id="requestedDate"
                className={cn('w-44', errors.requestedDate && 'border-error')}
                value={dateInputToDate(field.value)}
                onChange={(date) => field.onChange(dateToDateInput(date))}
                placeholder="Elegir fecha"
              />
            )}
          />
          {errors.requestedDate && (
            <span className="text-xs font-medium text-error">
              {errors.requestedDate.message}
            </span>
          )}
        </div>
        {/* (QL-166) Hora propuesta. Vacía → 18:00 al enviar. */}
        <div className="grid gap-1.5">
          <Label htmlFor="requestedTime" className="text-xs text-on-surface-variant">
            Hora
          </Label>
          <Input id="requestedTime" type="time" className="w-32" {...register('requestedTime')} />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="reason" className="text-xs text-on-surface-variant">
          Motivo <span className="text-error">*</span>
        </Label>
        <Textarea
          id="reason"
          rows={2}
          placeholder="Explica por qué necesitas mover la fecha…"
          className={cn(errors.reason && 'border-error')}
          {...register('reason')}
        />
        {errors.reason && (
          <span className="text-xs font-medium text-error">{errors.reason.message}</span>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onCancel}
          disabled={requestExtension.isPending}
        >
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={requestExtension.isPending}>
          {requestExtension.isPending && <Loader2 className="animate-spin" />}
          Enviar solicitud
        </Button>
      </div>
    </form>
  );
}
