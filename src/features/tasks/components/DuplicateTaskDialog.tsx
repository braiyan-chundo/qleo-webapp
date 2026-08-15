import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowRight,
  BellOff,
  CalendarClock,
  Copy,
  ListChecks,
  Loader2,
  Paperclip,
  Tag,
  TriangleAlert,
  UserMinus,
  UserCog,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

import { useColumns } from '@/features/columns/hooks/use-columns';
import { useProjects } from '@/features/projects/hooks/use-projects';
import { useUncheckAllChecklist } from '@/features/checklists/hooks/use-checklist';

import { useDuplicateTask } from '../hooks/use-tasks';
import { TASK_ROLE_LABEL } from '../lib/roles';
import { taskDateErrorMessage } from '../lib/open-ended';
import {
  duplicateTaskSchema,
  type DuplicateTaskValues,
} from '../schemas/task.schema';
import type { DuplicateTaskResult, Task } from '../services/tasks.service';
import {
  dateInputToDate,
  dateInputToIso,
  dateTimeInputToIso,
  dateToDateInput,
  isoToDateInput,
  isoToTimeInput,
  isOverdue,
} from '../lib/deadline';

interface DuplicateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** La tarea **ORIGINAL**. No se toca: la HU garantiza que no cambia nada en ella. */
  task: Task;
}

/**
 * (QL-201, §3.73) Diálogo **Duplicar tarea** — solo Dirección (`MANAGER`+; el backend responde
 * 403 a un MEMBER aunque sea el Creador).
 *
 * Tiene **dos pasos**, y el segundo no es un adorno:
 *
 * 1. **Destino y fechas.** El formulario ya conoce la tarea original, así que sabe de antemano si
 *    le faltan `startDate`/`dueDate` — el caso corriente: 60 de las 64 tareas de producción no
 *    tienen fecha de fin, y la **autorización de fin abierto no se hereda**, así que ni siquiera
 *    una tarea legítimamente sin fecha puede copiarse sin ponerle una. Se avisa **antes** de
 *    enviar en vez de dejar que el usuario descubra la regla con un 400.
 * 2. **Resumen de lo que ha pasado de verdad.** Duplicar no es una operación silenciosa: puede
 *    dejar gente fuera (`skippedParticipants`), cambiar el Responsable
 *    (`assigneeFellBackToDuplicator`), perder adjuntos (`attachmentsFailed`) — y **no avisa a
 *    nadie** (`notified: false`). Cerrar con un simple toast "listo" dejaría a Dirección
 *    suponiendo que su equipo ya se enteró y que la copia está completa. Ninguna de las dos cosas
 *    es cierta.
 */
export function DuplicateTaskDialog({
  open,
  onOpenChange,
  task,
}: DuplicateTaskDialogProps) {
  const duplicateTask = useDuplicateTask();
  /** Resultado de la copia: mientras es `null` se ve el formulario; después, el resumen. */
  const [result, setResult] = useState<DuplicateTaskResult | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<DuplicateTaskValues>({
    resolver: zodResolver(duplicateTaskSchema),
  });

  const targetProjectId = watch('projectId') ?? '';
  const dueDateValue = watch('dueDate') ?? '';
  const dueTimeValue = watch('dueTime') ?? '';
  /**
   * ¿La fecha de fin elegida ya pasó? Se comprueba con **hora incluida** (QL-166): mirar solo el
   * día daría un falso "ya pasó" en cuanto se elige hoy y son más de las 12:00, que es la hora a
   * la que un helper de solo-día ancla la fecha.
   */
  const dueAlreadyPast =
    !!dueDateValue && isOverdue(dateTimeInputToIso(dueDateValue, dueTimeValue));

  // Proyectos elegibles y columnas del destino: solo se piden con el diálogo abierto (y las
  // columnas, además, solo cuando ya hay un destino elegido).
  const projectsQuery = useProjects({ limit: 50, archived: false }, { enabled: open });
  const { data: targetColumns } = useColumns(
    open && targetProjectId ? targetProjectId : undefined,
  );

  /** Lo que la original NO puede aportar y por tanto hay que pedir aquí (§3.73 §5). */
  const missingStart = !task.startDate;
  const missingDue = !task.dueDate;

  useEffect(() => {
    if (!open) return;
    setResult(null);
    reset({
      projectId: '',
      columnId: '',
      // Sin prefijos "Copia de…": la marca de duplicado vive en `duplicatedFrom`, que es
      // estructurada y no se pierde al renombrar (§3.73 §1).
      title: task.title,
      startDate: isoToDateInput(task.startDate),
      dueDate: isoToDateInput(task.dueDate),
      dueTime: isoToTimeInput(task.dueDate),
    });
  }, [open, task, reset]);

  const onSubmit = (values: DuplicateTaskValues) => {
    duplicateTask.mutate(
      {
        id: task.id,
        data: {
          projectId: values.projectId,
          columnId: values.columnId || undefined,
          title: values.title.trim(),
          // Las dos van SIEMPRE explícitas: en el endpoint, omitir una fecha significa "hereda la
          // de la original", no "sin fecha".
          startDate: dateInputToIso(values.startDate) ?? undefined,
          dueDate:
            dateTimeInputToIso(values.dueDate, values.dueTime ?? '') ?? undefined,
        },
      },
      {
        onSuccess: (data) => setResult(data),
        onError: (err) => {
          toast.error(
            taskDateErrorMessage(err) ??
              (err instanceof Error ? err.message : 'No se pudo duplicar la tarea'),
          );
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        {result ? (
          <DuplicateResult
            result={result}
            originalTitle={task.title}
            onClose={() => onOpenChange(false)}
          />
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Duplicar tarea</DialogTitle>
              <DialogDescription>
                Se creará una copia de{' '}
                <span className="font-medium">{task.title}</span> en el proyecto que elijas. La
                tarea original no se toca.
              </DialogDescription>
            </DialogHeader>

            {/* Proyecto destino */}
            <div className="grid gap-1.5">
              <Label htmlFor="duplicateProject" className="text-on-surface">
                Proyecto de destino <span className="text-error">*</span>
              </Label>
              <Controller
                control={control}
                name="projectId"
                render={({ field }) => (
                  <NativeSelect
                    id="duplicateProject"
                    className={cn(
                      'w-full [&>select]:h-10',
                      errors.projectId && '[&>select]:border-error',
                    )}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  >
                    <NativeSelectOption value="">
                      {projectsQuery.isLoading
                        ? 'Cargando proyectos…'
                        : 'Selecciona un proyecto…'}
                    </NativeSelectOption>
                    {(projectsQuery.data?.data ?? []).map((p) => (
                      <NativeSelectOption key={p.id} value={p.id}>
                        {p.name}
                        {p.code ? ` · ${p.code}` : ''}
                        {p.id === task.projectId ? ' (el mismo)' : ''}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                )}
              />
              {errors.projectId && (
                <span className="text-xs font-medium text-error">
                  {errors.projectId.message}
                </span>
              )}
            </div>

            {/* Columna del destino (opcional). Solo tiene sentido con un destino elegido. */}
            {targetProjectId && (
              <div className="grid gap-1.5">
                <Label htmlFor="duplicateColumn" className="text-on-surface">
                  Columna
                </Label>
                <Controller
                  control={control}
                  name="columnId"
                  render={({ field }) => (
                    <NativeSelect
                      id="duplicateColumn"
                      className="w-full [&>select]:h-10"
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                    >
                      <NativeSelectOption value="">
                        Columna por defecto del tablero
                      </NativeSelectOption>
                      {(targetColumns ?? []).map((c) => (
                        <NativeSelectOption key={c.id} value={c.id}>
                          {c.name}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  )}
                />
              </div>
            )}

            {/* Título */}
            <div className="grid gap-1.5">
              <Label htmlFor="duplicateTitle" className="text-on-surface">
                Título de la copia <span className="text-error">*</span>
              </Label>
              <Input
                id="duplicateTitle"
                className={cn('h-10', errors.title && 'border-error')}
                maxLength={200}
                {...register('title')}
              />
              {errors.title && (
                <span className="text-xs font-medium text-error">{errors.title.message}</span>
              )}
            </div>

            {/* (§3.73 §5) El aviso que evita el 400. Se enseña ANTES de que el usuario envíe. */}
            {(missingStart || missingDue) && (
              <p className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-container/40 px-3 py-2 text-xs text-on-surface-variant">
                <CalendarClock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span>
                  {missingStart && missingDue
                    ? 'Esta tarea no tiene fecha de inicio ni de fin, así que hay que ponérselas a la copia.'
                    : missingStart
                      ? 'Esta tarea no tiene fecha de inicio, así que hay que ponérsela a la copia.'
                      : 'Esta tarea no tiene fecha de fin, así que hay que ponérsela a la copia.'}{' '}
                  {task.openEndedStatus === 'APPROVED' && (
                    <>
                      Dirección autorizó que <em>esta</em> tarea viviera sin fecha de fin en{' '}
                      <em>su</em> proyecto, y esa autorización no viaja a la copia: si la copia
                      también debe ir sin fecha, se pide por el flujo normal.
                    </>
                  )}
                </span>
              </p>
            )}

            {/* Fechas: siempre visibles y pre-rellenadas cuando la original las tiene. */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="duplicateStartDate" className="text-on-surface">
                  Fecha de inicio <span className="text-error">*</span>
                </Label>
                <Controller
                  control={control}
                  name="startDate"
                  render={({ field }) => (
                    <DatePicker
                      id="duplicateStartDate"
                      className="w-full"
                      value={dateInputToDate(field.value ?? '')}
                      onChange={(date) => field.onChange(dateToDateInput(date))}
                      placeholder="Elegir fecha"
                    />
                  )}
                />
                {errors.startDate && (
                  <span className="text-xs font-medium text-error">
                    {errors.startDate.message}
                  </span>
                )}
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="duplicateDueDate" className="text-on-surface">
                  Fecha de fin <span className="text-error">*</span>
                </Label>
                <div className="flex flex-wrap gap-2">
                  <Controller
                    control={control}
                    name="dueDate"
                    render={({ field }) => (
                      <DatePicker
                        id="duplicateDueDate"
                        className="w-full sm:flex-1"
                        value={dateInputToDate(field.value ?? '')}
                        onChange={(date) => field.onChange(dateToDateInput(date))}
                        placeholder="Elegir fecha"
                      />
                    )}
                  />
                  {dueDateValue && (
                    <Input
                      id="duplicateDueTime"
                      type="time"
                      className="h-10 w-28"
                      {...register('dueTime')}
                    />
                  )}
                </div>
                {errors.dueDate && (
                  <span className="text-xs font-medium text-error">
                    {errors.dueDate.message}
                  </span>
                )}
              </div>
            </div>

            {/* Heredar la fecha de una tarea vieja haría nacer la copia ya vencida. */}
            {dueAlreadyPast && (
              <p className="flex items-start gap-2 text-xs text-on-surface-variant">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                Esa fecha ya pasó: la copia nacería vencida.
              </p>
            )}

            {/* (§3.73 §8) Se dice ANTES de duplicar, no solo después: es información que puede
                cambiar la decisión, no solo el mensaje de despedida. */}
            <p className="flex items-start gap-2 rounded-lg bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant">
              <BellOff className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Duplicar no avisa a nadie. Se copian comentarios, adjuntos y checklist (con su
              estado marcado); los participantes que no sean miembros del proyecto de destino se
              quedarán fuera y te diremos quiénes.
            </p>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={duplicateTask.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={duplicateTask.isPending}>
                {duplicateTask.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Copy />
                )}
                Duplicar
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * (QL-201, §3.73 §6 §8) Resumen posterior a la copia. Es el paso que convierte una operación
 * opaca en una que el usuario entiende: quién se quedó fuera y por qué, si el Responsable
 * cambió, qué adjuntos no llegaron y —siempre— que **nadie ha sido avisado**.
 *
 * También es el sitio del "desmarcar todo" del checklist: el backend copia el estado `done`
 * porque el cliente pidió conservarlo, así que si lo que se quería era duplicar **para rehacer**,
 * el gesto va aquí, después y explícito, en vez de perder ese dato por defecto.
 */
function DuplicateResult({
  result,
  originalTitle,
  onClose,
}: {
  result: DuplicateTaskResult;
  originalTitle: string;
  onClose: () => void;
}) {
  const uncheckAll = useUncheckAllChecklist();
  const [unchecked, setUnchecked] = useState(false);

  const { copied, skippedParticipants, task } = result;
  const copyHref = `/projects/${result.projectId}/tasks/${result.id}`;

  const handleUncheckAll = () => {
    uncheckAll.mutate(result.id, {
      onSuccess: (count) => {
        setUnchecked(true);
        toast.success(
          count > 0
            ? `Se desmarcaron ${count} ${count === 1 ? 'ítem' : 'ítems'} del checklist de la copia.`
            : 'El checklist de la copia ya estaba sin marcar.',
        );
      },
      onError: (err) => {
        toast.error(
          err instanceof Error
            ? err.message
            : 'No se pudo desmarcar el checklist de la copia',
        );
      },
    });
  };

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Tarea duplicada</DialogTitle>
        <DialogDescription>
          <span className="font-medium">{originalTitle}</span> se copió como{' '}
          <span className="font-medium">{task.title}</span>. La original sigue intacta en su
          proyecto.
        </DialogDescription>
      </DialogHeader>

      {/* Censo de lo copiado. */}
      <dl className="grid grid-cols-2 gap-2 rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2.5 text-xs sm:grid-cols-4">
        <CopiedCount label="Comentarios" value={copied.comments} />
        <CopiedCount label="Checklist" value={copied.checklistItems} />
        <CopiedCount label="Adjuntos" value={copied.attachments} />
        <CopiedCount label="Participantes" value={copied.participants} />
      </dl>

      {/* (§3.73 §4) Un adjunto que no llegó no se esconde: hay que volver a subirlo a mano. */}
      {copied.attachmentsFailed > 0 && (
        <p className="flex items-start gap-2 rounded-lg border border-error/20 bg-error-container/50 px-3 py-2 text-xs text-on-error-container">
          <Paperclip className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            {copied.attachmentsFailed}{' '}
            {copied.attachmentsFailed === 1
              ? 'adjunto no se pudo copiar'
              : 'adjuntos no se pudieron copiar'}
            . Vuelve a subirlos en la copia.
          </span>
        </p>
      )}

      {/* (§3.73 §6) Quién se quedó fuera, CON NOMBRES. */}
      {skippedParticipants.length > 0 && (
        <section className="rounded-lg border border-warning/30 bg-warning-container/40 px-3 py-2.5">
          <p className="flex items-center gap-2 text-xs font-medium text-on-surface">
            <UserMinus className="size-3.5 shrink-0" aria-hidden />
            {skippedParticipants.length === 1
              ? 'Una persona no viajó a la copia'
              : `${skippedParticipants.length} personas no viajaron a la copia`}
          </p>
          <ul className="mt-2 space-y-1 text-xs text-on-surface-variant">
            {skippedParticipants.map((p) => (
              <li key={`${p.userId}-${p.role}`}>
                <span className="font-medium text-on-surface">{p.name}</span> ·{' '}
                {TASK_ROLE_LABEL[p.role]} — no es miembro del proyecto de destino.
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-on-surface-variant">
            No se les ha añadido al proyecto: dar acceso a un tablero entero es una decisión
            aparte, no un efecto secundario de duplicar. Si tienen que participar, añádelos como
            miembros del proyecto de destino y luego dales su rol en la copia.
          </p>
        </section>
      )}

      {/* (§3.73 §2) Mismo criterio que con las personas: lo que no viajó se dice. Adoptar la
          etiqueta en el destino cambiaría la configuración de ese proyecto sin que nadie lo
          pidiera, así que se descarta — pero en voz alta. */}
      {result.skippedLabels.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg border border-outline-variant/40 px-3 py-2 text-xs text-on-surface-variant">
          <Tag className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            {result.skippedLabels.length === 1 ? 'La etiqueta ' : 'Las etiquetas '}
            {result.skippedLabels.map((l) => `«${l.name}»`).join(', ')}{' '}
            {result.skippedLabels.length === 1 ? 'no viajó' : 'no viajaron'}: el proyecto de
            destino no {result.skippedLabels.length === 1 ? 'la' : 'las'} tiene adoptada
            {result.skippedLabels.length === 1 ? '' : 's'}.
          </span>
        </p>
      )}

      {/* (§3.73 §6, QL-192) El Responsable cambió: eso hay que decirlo, no deducirlo. */}
      {result.assigneeFellBackToDuplicator && (
        <p className="flex items-start gap-2 rounded-lg border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant">
          <UserCog className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            El Responsable de la original no es miembro del proyecto de destino, así que{' '}
            <strong className="font-medium text-on-surface">
              la copia queda a tu nombre
            </strong>
            . Ninguna tarea puede quedarse sin Responsable; cámbialo cuando quieras desde la copia.
          </span>
        </p>
      )}

      {/* (§3.73 §8) Siempre, incluso cuando todo salió bien. */}
      {!result.notified && (
        <p className="flex items-start gap-2 rounded-lg bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant">
          <BellOff className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            <strong className="font-medium text-on-surface">
              No se ha avisado a los participantes.
            </strong>{' '}
            Duplicar no genera notificaciones: si alguien tiene que enterarse, díselo tú.
          </span>
        </p>
      )}

      {/* (§3.73 §10) El checklist llegó con su estado marcado a propósito. Deshacerlo es una
          opción explícita, nunca el comportamiento por defecto. */}
      {copied.checklistItems > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-outline-variant/40 px-3 py-2.5">
          <p className="flex items-start gap-2 text-xs text-on-surface-variant">
            <ListChecks className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              El checklist se copió con su estado marcado. Si duplicaste para rehacer el trabajo,
              puedes empezar de cero.
            </span>
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleUncheckAll}
            disabled={uncheckAll.isPending || unchecked}
          >
            {uncheckAll.isPending && <Loader2 className="animate-spin" />}
            {unchecked ? 'Checklist desmarcado' : 'Desmarcar todo'}
          </Button>
        </div>
      )}

      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cerrar
        </Button>
        <Button asChild>
          <Link to={copyHref} onClick={onClose}>
            Abrir la copia
            <ArrowRight />
          </Link>
        </Button>
      </DialogFooter>
    </div>
  );
}

/** Una cifra del censo de lo copiado. */
function CopiedCount({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-on-surface-variant">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums text-on-surface">{value}</dd>
    </div>
  );
}
