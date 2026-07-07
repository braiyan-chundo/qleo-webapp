import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { CalendarClock, Loader2, Lock, LockOpen, Send, TriangleAlert } from 'lucide-react';

import { ApiError } from '@/core/api/fetch-client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

import { useCheckDate } from '@/features/work-calendar/hooks/use-work-calendar';

import { DatePicker } from '@/components/ui/date-picker';

import { useRequestDeadlineExtension, useSetDeadline } from '../hooks/use-tasks';
import {
  deadlineExtensionSchema,
  type DeadlineExtensionValues,
} from '../schemas/task.schema';
import type { Task } from '../services/tasks.service';
import {
  dateInputToDate,
  dateInputToIso,
  dateToDateInput,
  formatDueDate,
  isoToDateInput,
  isOverdue,
} from '../lib/deadline';

interface DeadlineSectionProps {
  task: Task;
  projectId: string;
}

/**
 * Sección "Fecha límite" del detalle de tarea (QL-09, RF-2.1). El gating depende de
 * `task.currentUserRole` y `task.deadlineLocked`:
 * - CREATOR: edita la fecha y togglea el bloqueo.
 * - ASSIGNEE/COLLABORATOR: editan la fecha si NO está bloqueada; si lo está, ven aviso y el
 *   botón "Solicitar prórroga".
 * - OBSERVER / no participante: solo lectura.
 */
export function DeadlineSection({ task, projectId }: DeadlineSectionProps) {
  const role = task.currentUserRole;
  const isCreator = role === 'CREATOR';
  const canEditRole = role === 'ASSIGNEE' || role === 'COLLABORATOR';
  const canRequestExtension = task.deadlineLocked && canEditRole;

  const setDeadline = useSetDeadline(projectId, task.id);

  const [dateValue, setDateValue] = useState(isoToDateInput(task.dueDate));
  const [showExtension, setShowExtension] = useState(false);

  // Re-sincroniza el input cuando cambian los datos de la tarea (p. ej. tras guardar).
  useEffect(() => {
    setDateValue(isoToDateInput(task.dueDate));
  }, [task.dueDate]);

  const overdue = isOverdue(task.dueDate);
  const editorDisabled = !isCreator && (!canEditRole || task.deadlineLocked);
  const dirty = dateValue !== isoToDateInput(task.dueDate);

  // QL-10 (RF-2.2): aviso NO bloqueante de día no laborable. Evalúa la fecha elegida en el
  // editor o, en su defecto, la `dueDate` ya guardada. El backend avisa, no reprograma.
  const checkDate = dateValue || isoToDateInput(task.dueDate);
  const { data: workCheck } = useCheckDate(checkDate, { enabled: !!checkDate });
  const showNonWorkingWarning = !!checkDate && workCheck?.isWorkingDay === false;

  const handleSave = () => {
    setDeadline.mutate(
      { dueDate: dateInputToIso(dateValue) },
      {
        onSuccess: () => toast.success('Fecha límite actualizada'),
        onError: (err) => handleDeadlineError(err),
      },
    );
  };

  const handleClear = () => {
    setDeadline.mutate(
      { dueDate: null },
      {
        onSuccess: () => toast.success('Fecha límite eliminada'),
        onError: (err) => handleDeadlineError(err),
      },
    );
  };

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
          <span className="text-on-surface-variant">Sin fecha límite.</span>
        )}
      </p>

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
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={editorDisabled || setDeadline.isPending || !dirty}
          >
            {setDeadline.isPending && <Loader2 className="animate-spin" />}
            Guardar
          </Button>
          {task.dueDate && !editorDisabled && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleClear}
              disabled={setDeadline.isPending}
            >
              Quitar
            </Button>
          )}
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
      reason: '',
    },
  });

  const onSubmit = (values: DeadlineExtensionValues) => {
    const requestedDate = dateInputToIso(values.requestedDate);
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
