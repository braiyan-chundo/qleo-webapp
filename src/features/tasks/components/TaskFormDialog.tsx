import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { useColumns } from '@/features/columns/hooks/use-columns';
import { useProject, useProjectMembers } from '@/features/projects/hooks/use-projects';
import { TaskLabelSelect } from '@/features/labels/components/TaskLabelSelect';
import { ApiError } from '@/core/api/fetch-client';
import { useAuthStore } from '@/store/auth.store';

import { DatePicker } from '@/components/ui/date-picker';

import { useCreateTask, useUpdateTask } from '../hooks/use-tasks';
import { TaskParticipantsPicker } from './TaskParticipantsPicker';
import { taskFormSchema, type TaskFormValues } from '../schemas/task.schema';
import type { Task } from '../services/tasks.service';
import {
  dateInputToDate,
  dateInputToIso,
  dateTimeInputToIso,
  dateToDateInput,
  isoToDateInput,
  isoToTimeInput,
} from '../lib/deadline';

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  /** Si se pasa, el diálogo funciona en modo edición. */
  task?: Task;
  /**
   * (QL-178, §3.58) **Edición completa**: además del núcleo, el formulario muestra y envía la
   * **fecha límite** (con hora y bloqueo) y los **participantes** (Responsable, Colaboradores,
   * Observadores) en un único `PATCH` atómico.
   *
   * Solo para el menú **solo-ADMIN** (`TaskAdminMenu`). El modo edición del CREATOR
   * (`TaskCreatorActions`) sigue siendo el formulario **reducido** —decisión del cliente—:
   * ahí el deadline lo lleva la `DeadlineSection` y los roles el `RoleManager` del detalle.
   */
  fullEdit?: boolean;
  /** Al crear desde "+ Añadir tarea" de una columna, presetea esa columna. */
  presetColumnId?: string;
}

const emptyValues: TaskFormValues = {
  title: '',
  description: '',
  columnId: '',
  labelId: '',
  startDate: '',
  dueDate: '',
  dueTime: '',
  deadlineLocked: false,
  assigneeId: '',
  collaboratorIds: [],
  observerIds: [],
};

/**
 * Traduce el `error.code` de negocio del alta/edición a un mensaje claro (QL-123, QL-178 §3.58).
 * **Siempre por `error.code`**, nunca por el texto del backend.
 */
function taskFormErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'USER_NOT_PROJECT_MEMBER':
        return 'Solo puedes asignar a miembros del proyecto.';
      case 'LABEL_NOT_IN_PROJECT':
        return 'Esa etiqueta no está disponible en este proyecto.';
      case 'READ_ONLY_ROLE':
        return 'Tu rol en esta tarea es de solo lectura.';
      case 'TASK_OWNERSHIP_REQUIRED':
        return 'Solo el Creador de la tarea o un administrador pueden editarla.';
      case 'COLUMN_SEQUENCE_VIOLATION':
        // (QL-135, §3.33) Misma regla que espeja `lib/column-sequence` en el board.
        return 'Solo puedes mover la tarea a una columna contigua.';
    }
  }
  return err instanceof Error ? err.message : fallback;
}

/** Ids de los participantes de la tarea con un rol dado (QL-178: precarga de la edición). */
function userIdsWithRole(task: Task, role: 'COLLABORATOR' | 'OBSERVER'): string[] {
  return task.assignments.filter((a) => a.role === role).map((a) => a.userId);
}

/** Crear/editar una tarea (QL-07). Solo requiere título + columna (opcional; default Backlog). */
export function TaskFormDialog({
  open,
  onOpenChange,
  projectId,
  task,
  fullEdit = false,
  presetColumnId,
}: TaskFormDialogProps) {
  const isEdit = !!task;
  /** (QL-178) Edición **completa** (solo-ADMIN): incluye deadline y participantes. */
  const isFullEdit = isEdit && fullEdit;
  /** Campos de deadline/participantes: presentes en el alta y en la edición completa. */
  const showFullFields = !isEdit || isFullEdit;

  const { data: columns, isLoading: columnsLoading } = useColumns(
    open ? projectId : undefined,
  );
  // (QL-146) El selector de etiqueta ofrece SOLO `project.labels`. Se pide con el diálogo abierto
  // (mismo patrón que `BoardSettingsDialog`). El backend rechaza etiquetas ajenas al proyecto.
  const { data: project } = useProject(open ? projectId : undefined);
  const projectLabels = project?.labels ?? [];
  const defaultColumn = columns?.find((c) => c.isDefault);
  // (QL-63) Al crear se preselecciona explícitamente la columna Backlog (equivale a la
  // `isDefault` inicial); si no hubiera, cae en la default. El selector sigue editable.
  const backlogColumn = columns?.find((c) => c.isBacklog) ?? defaultColumn;
  const backlogColumnId = backlogColumn?.id;

  // (QL-123) Roles: los candidatos son la membresía del proyecto. Solo se piden con el diálogo
  // abierto y cuando el picker se va a renderizar — en el alta, y (QL-178) en la edición
  // completa del ADMIN. En la edición reducida del CREATOR los roles los lleva el RoleManager.
  const currentUserId = useAuthStore((s) => s.user?.id);
  const { data: members, isLoading: membersLoading } = useProjectMembers(
    open && showFullFields ? projectId : undefined,
  );

  /**
   * (QL-178) `CREATOR` intocable del picker: al crear es el usuario del token; en la edición
   * completa, el creador real de la tarea (que puede no ser el ADMIN que edita).
   */
  const creatorUserId = isFullEdit
    ? task?.assignments.find((a) => a.role === 'CREATOR')?.userId
    : currentUserId;

  const createTask = useCreateTask(projectId);
  const updateTask = useUpdateTask(projectId);
  const isPending = createTask.isPending || updateTask.isPending;

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: emptyValues,
  });

  const assigneeId = watch('assigneeId') ?? '';
  const collaboratorIds = watch('collaboratorIds') ?? [];
  const observerIds = watch('observerIds') ?? [];
  // (P1) El toggle de bloqueo solo aplica cuando ya se eligió una fecha límite.
  const dueDateValue = watch('dueDate') ?? '';

  useEffect(() => {
    if (!open) return;
    if (task) {
      reset({
        title: task.title,
        description: task.description ?? '',
        columnId: task.columnId,
        labelId: task.labels[0]?.id ?? '',
        startDate: isoToDateInput(task.startDate),
        // (QL-178) En la edición COMPLETA (solo-ADMIN) se precargan deadline y participantes
        // desde la tarea; en la reducida del CREATOR siguen fuera del formulario (los llevan
        // la DeadlineSection y el RoleManager del detalle), así que van vacíos y no se envían.
        dueDate: fullEdit ? isoToDateInput(task.dueDate) : '',
        dueTime: fullEdit ? isoToTimeInput(task.dueDate) : '',
        deadlineLocked: fullEdit ? task.deadlineLocked : false,
        assigneeId: fullEdit
          ? (task.assignments.find((a) => a.role === 'ASSIGNEE')?.userId ?? '')
          : '',
        collaboratorIds: fullEdit ? userIdsWithRole(task, 'COLLABORATOR') : [],
        observerIds: fullEdit ? userIdsWithRole(task, 'OBSERVER') : [],
      });
    } else {
      reset({
        ...emptyValues,
        // Preselección explícita: la columna concreta si se abrió desde "+ Añadir tarea" de
        // una columna; si no, la Backlog. '' solo si aún no cargaron las columnas.
        columnId: presetColumnId ?? backlogColumnId ?? '',
      });
    }
  }, [open, task, fullEdit, presetColumnId, backlogColumnId, reset]);

  /**
   * (QL-123/QL-138) Aplica la precedencia `ASSIGNEE > COLLABORATOR > OBSERVER` al payload: un
   * usuario tiene UN rol por tarea. La UI ya lo refleja al elegir, pero se vuelve a imponer
   * aquí para que el payload no dependa del orden en que se tocaron los controles.
   */
  const resolveRoles = (values: TaskFormValues) => {
    const assigneeId_ = values.assigneeId || null;
    const collaboratorIds_ = (values.collaboratorIds ?? []).filter(
      (id) => id !== assigneeId_,
    );
    const observerIds_ = (values.observerIds ?? []).filter(
      (id) => id !== assigneeId_ && !collaboratorIds_.includes(id),
    );
    return {
      assigneeId: assigneeId_,
      collaboratorIds: collaboratorIds_,
      observerIds: observerIds_,
    };
  };

  const onSubmit = (values: TaskFormValues) => {
    const description = values.description?.trim() || undefined;
    // (QL-146) `labelIds` con 0 o 1 elemento; `[]` deja la tarea sin etiqueta.
    const labelIds = values.labelId ? [values.labelId] : [];
    const startDate = dateInputToIso(values.startDate ?? '');

    if (isEdit && task) {
      // (QL-178, §3.58) Un único PATCH atómico. El backend acepta el formulario completo y es
      // idempotente (solo audita lo que cambió de verdad), así que no calculamos el diff en
      // cliente. Ojo con la semántica: `null` limpia, `[]` vacía el conjunto, **omitido no
      // toca** — por eso la edición reducida del CREATOR no manda deadline ni roles.
      const roles = isFullEdit ? resolveRoles(values) : null;
      const dueDate = isFullEdit
        ? dateTimeInputToIso(values.dueDate ?? '', values.dueTime ?? '')
        : undefined;

      updateTask.mutate(
        {
          id: task.id,
          data: {
            title: values.title.trim(),
            description,
            columnId: values.columnId || undefined,
            labelIds,
            // `null` limpia la fecha si el usuario la borró.
            startDate,
            ...(isFullEdit
              ? {
                  // Si el usuario borró la fecha hay que mandar `null` explícito, no omitirla.
                  dueDate,
                  // Bloquear un deadline nulo no significa nada: sin fecha, se desbloquea.
                  deadlineLocked: dueDate ? !!values.deadlineLocked : false,
                  assigneeId: roles?.assigneeId ?? null,
                  collaboratorIds: roles?.collaboratorIds ?? [],
                  observerIds: roles?.observerIds ?? [],
                }
              : {}),
          },
        },
        {
          onSuccess: () => {
            toast.success('Tarea actualizada');
            onOpenChange(false);
          },
          onError: (err) => {
            toast.error(taskFormErrorMessage(err, 'No se pudo actualizar la tarea'));
          },
        },
      );
    } else {
      // (QL-123/QL-138) Roles iniciales: los tres opcionales.
      const { assigneeId: nextAssigneeId, collaboratorIds: nextCollaboratorIds, observerIds: nextObserverIds } =
        resolveRoles(values);

      // (P1/§3.6) Fecha límite opcional en el alta. (QL-166) Con hora: fecha + hora → ISO
      // completo (hora vacía → 18:00). `deadlineLocked` solo tiene sentido con una fecha
      // (bloquear un deadline nulo no aporta nada), así que se envía solo si la hay.
      const dueDate =
        dateTimeInputToIso(values.dueDate ?? '', values.dueTime ?? '') ?? undefined;
      const deadlineLocked = dueDate && values.deadlineLocked ? true : undefined;

      createTask.mutate(
        {
          projectId,
          title: values.title.trim(),
          description,
          columnId: values.columnId || undefined,
          labelIds,
          startDate,
          dueDate,
          deadlineLocked,
          assigneeId: nextAssigneeId ?? undefined,
          collaboratorIds: nextCollaboratorIds.length
            ? nextCollaboratorIds
            : undefined,
          observerIds: nextObserverIds.length ? nextObserverIds : undefined,
        },
        {
          onSuccess: () => {
            toast.success('Tarea creada');
            onOpenChange(false);
          },
          onError: (err) => {
            toast.error(taskFormErrorMessage(err, 'No se pudo crear la tarea'));
          },
        },
      );
    }
  };

  const noColumns = !columnsLoading && (!columns || columns.length === 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar tarea' : 'Nueva tarea'}</DialogTitle>
          <DialogDescription>
            {isFullEdit
              ? 'Edición completa de administrador: se guardan de una vez los datos, la fecha límite y los participantes. El título es obligatorio.'
              : 'Cada tarea pertenece a una columna de estado. El título es obligatorio.'}
          </DialogDescription>
        </DialogHeader>

        {noColumns && (
          <div className="rounded-lg border border-error/20 bg-error-container px-4 py-3 text-sm font-medium text-on-error-container">
            El proyecto no tiene columnas. Crea al menos una columna de estado antes de
            añadir tareas.
          </div>
        )}

        <form
          id="task-form"
          onSubmit={handleSubmit(onSubmit)}
          className="grid gap-4"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="title" className="text-on-surface">
              Título <span className="text-error">*</span>
            </Label>
            <Input
              id="title"
              placeholder="Redactar la propuesta"
              className="h-10"
              {...register('title')}
            />
            {errors.title && (
              <span className="text-xs font-medium text-error">
                {errors.title.message}
              </span>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="columnId" className="text-on-surface">
              Columna
            </Label>
            <Controller
              control={control}
              name="columnId"
              render={({ field }) => (
                <NativeSelect
                  id="columnId"
                  className="w-full [&>select]:h-10"
                  disabled={columnsLoading || noColumns}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                >
                  <NativeSelectOption value="">
                    {defaultColumn
                      ? `Por defecto (${defaultColumn.name})`
                      : 'Columna por defecto'}
                  </NativeSelectOption>
                  {columns?.map((column) => (
                    <NativeSelectOption key={column.id} value={column.id}>
                      {column.name}
                      {column.isDefault ? ' (por defecto)' : ''}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
            />
          </div>

          {/* (QL-146) Etiqueta: una sola, elegida del catálogo del proyecto (`project.labels`).
              Si el proyecto no tiene etiquetas, el selector muestra un vacío explicativo. */}
          <div className="grid gap-1.5">
            <Label className="text-on-surface">Etiqueta</Label>
            <Controller
              control={control}
              name="labelId"
              render={({ field }) => (
                <TaskLabelSelect
                  labels={projectLabels}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                />
              )}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="startDate" className="text-on-surface">
              Fecha de inicio
            </Label>
            <Controller
              control={control}
              name="startDate"
              render={({ field }) => (
                <DatePicker
                  id="startDate"
                  className="w-full sm:w-1/2"
                  value={dateInputToDate(field.value ?? '')}
                  onChange={(date) => field.onChange(dateToDateInput(date))}
                  placeholder="Sin fecha"
                />
              )}
            />
          </div>

          {/* (P1/§3.6) Fecha límite en el ALTA y (QL-178) en la edición completa del ADMIN.
              En la edición reducida del CREATOR se gestiona con la DeadlineSection del detalle
              (bloqueo, prórroga, calendario laboral). */}
          {showFullFields && (
            <div className="grid gap-1.5">
              <Label htmlFor="dueDate" className="text-on-surface">
                Fecha límite
              </Label>
              <div className="flex flex-wrap items-center gap-2">
                <Controller
                  control={control}
                  name="dueDate"
                  render={({ field }) => (
                    <DatePicker
                      id="dueDate"
                      className="w-full sm:flex-1"
                      value={dateInputToDate(field.value ?? '')}
                      onChange={(date) => field.onChange(dateToDateInput(date))}
                      placeholder="Sin fecha límite"
                    />
                  )}
                />
                {/* (QL-166) Hora del deadline; solo aplica con una fecha elegida. Vacía → 18:00. */}
                {dueDateValue && (
                  <Input id="dueTime" type="time" className="h-10 w-32" {...register('dueTime')} />
                )}
              </div>
              {dueDateValue && (
                <Controller
                  control={control}
                  name="deadlineLocked"
                  render={({ field }) => (
                    <label className="mt-1 flex items-center gap-2 text-sm text-on-surface">
                      <Switch
                        checked={!!field.value}
                        onCheckedChange={field.onChange}
                      />
                      <span className="text-on-surface-variant">
                        Bloquear edición de la fecha para Responsable y Colaboradores
                      </span>
                    </label>
                  )}
                />
              )}
            </div>
          )}

          {/* (QL-123/QL-138) Responsable, Colaboradores y Observadores en el ALTA y (QL-178) en
              la edición completa del ADMIN. En la edición reducida del CREATOR los roles se
              gestionan con el RoleManager de la vista de detalle (no se duplica aquí). */}
          {showFullFields && (
            <TaskParticipantsPicker
              members={members}
              isLoading={membersLoading}
              creatorUserId={creatorUserId}
              assigneeHint={
                isFullEdit
                  ? 'Solo puede haber un Responsable por tarea. El Creador no se puede cambiar.'
                  : undefined
              }
              assigneeId={assigneeId}
              collaboratorIds={collaboratorIds}
              observerIds={observerIds}
              onAssigneeChange={(id) => setValue('assigneeId', id)}
              onCollaboratorsChange={(ids) => setValue('collaboratorIds', ids)}
              onObserversChange={(ids) => setValue('observerIds', ids)}
              disabled={isPending}
            />
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="description" className="text-on-surface">
              Descripción
            </Label>
            <Textarea
              id="description"
              rows={3}
              placeholder="Detalles, alcance o notas de la tarea…"
              {...register('description')}
            />
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
          <Button
            type="submit"
            form="task-form"
            disabled={isPending || noColumns}
          >
            {isPending && <Loader2 className="animate-spin" />}
            {isEdit ? 'Guardar cambios' : 'Crear tarea'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
