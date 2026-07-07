import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';

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

import { useCreateProject, useUpdateProject } from '../hooks/use-projects';
import {
  projectFormSchema,
  type ProjectFormValues,
} from '../schemas/project.schema';
import { DatePicker } from '@/components/ui/date-picker';

import { ProjectColorPicker } from './ProjectColorPicker';
import type { ProjectPayload } from '../services/projects.service';
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
  destination: '',
  description: '',
  startDate: '',
  endDate: '',
  color: '',
};

/** Convierte los valores del formulario al payload que espera el backend. */
function toPayload(values: ProjectFormValues): ProjectPayload {
  return {
    name: values.name.trim(),
    code: values.code?.trim() || undefined,
    clientGroup: values.clientGroup?.trim() || undefined,
    destination: values.destination?.trim() || undefined,
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
  const createMutation = useCreateProject();
  const updateMutation = useUpdateProject();

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
    if (project) {
      reset({
        name: project.name,
        code: project.code ?? '',
        clientGroup: project.clientGroup ?? '',
        destination: project.destination ?? '',
        description: project.description ?? '',
        startDate: isoToDateInput(project.startDate),
        endDate: isoToDateInput(project.endDate),
        color: project.color ?? '',
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
      updateMutation.mutate(
        { id: project.id, data: payload },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => onOpenChange(false),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Editar proyecto' : 'Nuevo proyecto'}
          </DialogTitle>
          <DialogDescription>
            Un proyecto es un expediente de viaje. El nombre es obligatorio; el
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
              placeholder="EXP-001 - Grupo Alfa - Cancún - Jul 2026"
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
                placeholder="EXP-001"
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
                placeholder="Grupo Alfa"
                className="h-10"
                {...register('clientGroup')}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="destination" className="text-on-surface">
              Destino
            </Label>
            <Input
              id="destination"
              placeholder="Cancún, México"
              className="h-10"
              {...register('destination')}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="startDate" className="text-on-surface">
                Inicio del viaje
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
                Fin del viaje
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
              placeholder="Notas del expediente, alcance, condiciones…"
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
          <Button type="submit" form="project-form" disabled={isPending}>
            {isPending && <Loader2 className="animate-spin" />}
            {isEdit ? 'Guardar cambios' : 'Crear proyecto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
