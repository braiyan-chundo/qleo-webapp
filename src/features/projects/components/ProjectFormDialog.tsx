import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DatePicker } from '@/components/ui/date-picker';
import { useAuthStore } from '@/store/auth.store';
import type { UserDirectoryEntry } from '@/features/users/services/users.service';

import {
  useCreateProjectWithMembers,
  useUpdateProject,
} from '../hooks/use-projects';
import {
  projectFormSchema,
  type ProjectFormValues,
} from '../schemas/project.schema';

import { ProjectColorPicker } from './ProjectColorPicker';
import { MemberMultiSelect } from './MemberMultiSelect';
import { ProjectMembersPanel } from './ProjectMembersPanel';
import type {
  ProjectPayload,
  UpdateProjectPayload,
} from '../services/projects.service';
import type { Project } from '../types/project';
import {
  dateInputToDate,
  dateInputToIso,
  dateToDateInput,
  isoToDateInput,
} from '../utils/dates';

interface ProjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Si se pasa, el diálogo funciona en modo edición. */
  project?: Project;
}

const emptyValues: ProjectFormValues = {
  name: '',
  code: '',
  clientGroup: '',
  description: '',
  startDate: '',
  endDate: '',
  color: '',
  // (P7) Solo se muestra/edita en edición; en el alta el backend aplica el default (24 h).
  deadlineWarningHours: '',
};

/** Convierte los valores del formulario al payload que espera el backend. */
function toPayload(values: ProjectFormValues): ProjectPayload {
  return {
    name: values.name.trim(),
    code: values.code?.trim() || undefined,
    clientGroup: values.clientGroup?.trim() || undefined,
    description: values.description?.trim() || undefined,
    startDate: dateInputToIso(values.startDate),
    endDate: dateInputToIso(values.endDate),
    // `''` (sin color) se envía como `null` para limpiar el color en el backend.
    color: values.color ? values.color : null,
  };
}

export function ProjectFormDialog({
  open,
  onOpenChange,
  project,
}: ProjectFormDialogProps) {
  const isEdit = !!project;
  const user = useAuthStore((s) => s.user);
  const createMutation = useCreateProjectWithMembers();
  const updateMutation = useUpdateProject();

  // Miembros pre-seleccionados en la CREACIÓN (en edición se gestionan en vivo).
  const [members, setMembers] = useState<UserDirectoryEntry[]>([]);

  const canManage =
    isEdit && !!user && (user.role === 'ADMIN' || project.createdBy === user.id);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: emptyValues,
  });

  // Rellena / reinicia el formulario cuando cambia el proyecto o se abre el diálogo.
  useEffect(() => {
    if (!open) return;
    setMembers([]);
    if (project) {
      reset({
        name: project.name,
        code: project.code ?? '',
        clientGroup: project.clientGroup ?? '',
        description: project.description ?? '',
        startDate: isoToDateInput(project.startDate),
        endDate: isoToDateInput(project.endDate),
        color: project.color ?? '',
        deadlineWarningHours: String(project.deadlineWarningHours ?? 24),
      });
    } else {
      reset(emptyValues);
    }
  }, [open, project, reset]);

  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error ?? updateMutation.error;
  const errorMessage =
    mutationError instanceof Error ? mutationError.message : '';

  const onSubmit = (values: ProjectFormValues) => {
    const payload = toPayload(values);

    if (isEdit && project) {
      const updateData: UpdateProjectPayload = { ...payload };
      // (P7) Antelación del aviso de deadline; solo se envía si es un entero válido 1–720.
      const warnHours = Number(values.deadlineWarningHours);
      if (Number.isInteger(warnHours) && warnHours >= 1 && warnHours <= 720) {
        updateData.deadlineWarningHours = warnHours;
      }
      updateMutation.mutate(
        { id: project.id, data: updateData },
        { onSuccess: () => onOpenChange(false) },
      );
      return;
    }

    // Creación: crea el proyecto y luego añade cada miembro (POST /projects/:id/members).
    createMutation.mutate(
      { data: payload, members },
      {
        onSuccess: ({ failed }) => {
          if (failed.length > 0) {
            toast.warning(
              `Proyecto creado, pero no se pudo añadir a: ${failed
                .map((m) => m.name)
                .join(', ')}. Puedes reintentarlo desde el proyecto.`,
            );
          } else {
            toast.success('Proyecto creado');
          }
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Editar proyecto' : 'Nuevo proyecto'}
          </DialogTitle>
          <DialogDescription>
            Un proyecto agrupa tareas y personas. El nombre es obligatorio; el
            resto de campos son opcionales.
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <div className="rounded-lg border border-error/20 bg-error-container px-4 py-3 text-sm font-medium text-on-error-container">
            {errorMessage}
          </div>
        )}

        <form
          id="project-form"
          onSubmit={handleSubmit(onSubmit)}
          className="grid gap-4"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="name" className="text-on-surface">
              Nombre <span className="text-error">*</span>
            </Label>
            <Input
              id="name"
              placeholder="Nombre del proyecto"
              className="h-10"
              {...register('name')}
            />
            {errors.name && (
              <span className="text-xs font-medium text-error">
                {errors.name.message}
              </span>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="code" className="text-on-surface">
                Código
              </Label>
              <Input
                id="code"
                placeholder="PRJ-001"
                className="h-10"
                {...register('code')}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="clientGroup" className="text-on-surface">
                Cliente / grupo
              </Label>
              <Input
                id="clientGroup"
                placeholder="Cliente o grupo"
                className="h-10"
                {...register('clientGroup')}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="startDate" className="text-on-surface">
                Inicio
              </Label>
              <Controller
                control={control}
                name="startDate"
                render={({ field }) => (
                  <DatePicker
                    id="startDate"
                    className="w-full"
                    value={dateInputToDate(field.value)}
                    onChange={(date) => field.onChange(dateToDateInput(date))}
                    placeholder="Sin fecha"
                  />
                )}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="endDate" className="text-on-surface">
                Fin
              </Label>
              <Controller
                control={control}
                name="endDate"
                render={({ field }) => (
                  <DatePicker
                    id="endDate"
                    className="w-full"
                    value={dateInputToDate(field.value)}
                    onChange={(date) => field.onChange(dateToDateInput(date))}
                    placeholder="Sin fecha"
                  />
                )}
              />
              {errors.endDate && (
                <span className="text-xs font-medium text-error">
                  {errors.endDate.message}
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="description" className="text-on-surface">
              Descripción
            </Label>
            <Textarea
              id="description"
              rows={3}
              placeholder="Notas del proyecto, alcance, condiciones…"
              {...register('description')}
            />
          </div>

          <div className="grid gap-1.5">
            <Label className="text-on-surface">Color distintivo</Label>
            <Controller
              control={control}
              name="color"
              render={({ field }) => (
                <ProjectColorPicker
                  value={field.value ?? ''}
                  onChange={field.onChange}
                />
              )}
            />
          </div>

          {/* (P7, §3.4) Antelación del aviso de deadline al Responsable. Solo en edición
              (en el alta el backend aplica el default de 24 h). */}
          {isEdit && (
            <div className="grid gap-1.5">
              <Label htmlFor="deadlineWarningHours" className="text-on-surface">
                Avisar al responsable X horas antes del vencimiento
              </Label>
              <Input
                id="deadlineWarningHours"
                type="number"
                min={1}
                max={720}
                step={1}
                placeholder="24"
                className="h-10 w-32"
                {...register('deadlineWarningHours')}
              />
              <p className="text-xs text-on-surface-variant">
                Entre 1 y 720 horas. Por defecto 24 h.
              </p>
              {errors.deadlineWarningHours && (
                <span className="text-xs font-medium text-error">
                  {errors.deadlineWarningHours.message}
                </span>
              )}
            </div>
          )}
        </form>

        {/* Miembros: pre-selección en creación; gestión en vivo en edición (gate canManage). */}
        <div className="grid gap-1.5 border-t border-outline-variant/40 pt-4">
          {isEdit && project ? (
            canManage ? (
              <ProjectMembersPanel
                projectId={project.id}
                createdBy={project.createdBy}
                managerIds={project.managerIds}
                canManage={canManage}
              />
            ) : null
          ) : (
            <>
              <Label className="text-on-surface">Miembros</Label>
              <p className="text-xs text-on-surface-variant">
                Solo los miembros ven el proyecto y pueden recibir sus tareas.
              </p>
              {user && (
                <MemberMultiSelect
                  value={members}
                  onChange={setMembers}
                  creator={{
                    id: user.id,
                    name: user.name,
                    avatarDownloadUrl: user.avatarDownloadUrl,
                    avatarUrl: user.avatarUrl,
                  }}
                />
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {isEdit ? 'Cerrar' : 'Cancelar'}
          </Button>
          <Button type="submit" form="project-form" disabled={isPending}>
            {isPending && <Loader2 className="animate-spin" />}
            {isEdit ? 'Guardar cambios' : 'Crear proyecto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
