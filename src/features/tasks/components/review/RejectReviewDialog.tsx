import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2, ThumbsDown } from 'lucide-react';

import { ApiError } from '@/core/api/fetch-client';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { useRejectReview } from '../../hooks/use-tasks';
import {
  REVIEW_COMMENT_MAX,
  rejectReviewSchema,
  type RejectReviewValues,
} from '../../schemas/task.schema';
import type { Task } from '../../services/tasks.service';
import {
  DEFAULT_DEADLINE_TIME,
  dateInputToDate,
  dateTimeInputToIso,
  dateToDateInput,
  formatDueDate,
  isoToTimeInput,
} from '../../lib/deadline';

interface RejectReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task;
  projectId: string;
  /**
   * ¿Quien rechaza es el **CREATOR**? Gobierna si se ofrece mover la fecha límite: el backend
   * solo se lo permite a él y, si otro rol manda `newDueDate`, responde 403
   * `DEADLINE_EXTENSION_CREATOR_ONLY` **y ni siquiera aplica el rechazo**. Por eso el selector
   * se **oculta** (no se deshabilita) para los observadores.
   */
  isCreator: boolean;
}

/**
 * (QL-171/QL-172) Diálogo de **rechazo de la revisión**: motivo **obligatorio** (rhf+zod, máx
 * 2000) y, solo para el CREATOR, una **nueva fecha límite** opcional con el patrón fecha+hora de
 * QL-166 (`DatePicker` + `<input type="time">`, serializado con `dateTimeInputToIso`).
 *
 * Tras el rechazo el backend limpia `reviewRequestedAt/By`: el Responsable recibe la
 * notificación `TASK_REVIEW_REJECTED` con el motivo, corrige y vuelve a solicitar revisión.
 */
export function RejectReviewDialog({
  open,
  onOpenChange,
  task,
  projectId,
  isCreator,
}: RejectReviewDialogProps) {
  const rejectReview = useRejectReview(projectId, task.id);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RejectReviewValues>({
    resolver: zodResolver(rejectReviewSchema),
    defaultValues: {
      comment: '',
      // Vacía = "no cambiar la fecha"; la hora arranca en la del deadline vigente (o 18:00).
      newDueDate: '',
      newDueTime: isoToTimeInput(task.dueDate) || DEFAULT_DEADLINE_TIME,
    },
  });

  // Limpia el formulario cada vez que se reabre el diálogo (no arrastra el motivo anterior).
  useEffect(() => {
    if (open) {
      reset({
        comment: '',
        newDueDate: '',
        newDueTime: isoToTimeInput(task.dueDate) || DEFAULT_DEADLINE_TIME,
      });
    }
  }, [open, reset, task.dueDate]);

  const onSubmit = (values: RejectReviewValues) => {
    // La fecha SOLO viaja si quien rechaza es el creador y eligió día (evita el 403 que además
    // tumbaría el rechazo entero).
    const newDueDate =
      isCreator && values.newDueDate
        ? dateTimeInputToIso(values.newDueDate, values.newDueTime)
        : null;

    rejectReview.mutate(
      {
        comment: values.comment.trim(),
        ...(newDueDate ? { newDueDate } : {}),
      },
      {
        onSuccess: () => {
          toast.success('Revisión rechazada. Se notificó al responsable.');
          onOpenChange(false);
        },
        onError: (err) => {
          if (err instanceof ApiError) {
            if (err.code === 'TASK_VALIDATION_FORBIDDEN') {
              toast.error('Solo el creador o un observador pueden rechazar la revisión.');
              return;
            }
            if (err.code === 'DEADLINE_EXTENSION_CREATOR_ONLY') {
              toast.error(
                'Solo el creador puede mover la fecha límite: el rechazo no se aplicó.',
              );
              return;
            }
          }
          toast.error(
            err instanceof Error ? err.message : 'No se pudo rechazar la revisión',
          );
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Rechazar revisión</DialogTitle>
            <DialogDescription>
              La tarea <span className="font-medium">{task.title}</span> vuelve al responsable
              con tus observaciones; podrá corregir y solicitar la revisión de nuevo.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-1.5">
            <Label htmlFor="rejectionComment" className="text-xs text-on-surface-variant">
              Motivo del rechazo <span className="text-error">*</span>
            </Label>
            <Textarea
              id="rejectionComment"
              rows={4}
              maxLength={REVIEW_COMMENT_MAX}
              placeholder="Qué falta o qué hay que corregir…"
              className={cn(errors.comment && 'border-error')}
              {...register('comment')}
            />
            {errors.comment && (
              <span className="text-xs font-medium text-error">{errors.comment.message}</span>
            )}
          </div>

          {/* (QL-172) Extensión de plazo: EXCLUSIVA del creador; para el resto ni se pinta. */}
          {isCreator && (
            <div className="grid gap-1.5 rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-3">
              <p className="text-xs font-medium text-on-surface">
                Mover la fecha límite (opcional)
              </p>
              <p className="text-xs text-on-surface-variant">
                {task.dueDate
                  ? `Actualmente: ${formatDueDate(task.dueDate)}`
                  : 'La tarea no tiene fecha límite.'}
              </p>
              <div className="mt-1 flex flex-wrap items-end gap-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="newDueDate" className="text-xs text-on-surface-variant">
                    Nueva fecha
                  </Label>
                  <Controller
                    control={control}
                    name="newDueDate"
                    render={({ field }) => (
                      <DatePicker
                        id="newDueDate"
                        className="w-44"
                        value={dateInputToDate(field.value ?? '')}
                        onChange={(date) => field.onChange(dateToDateInput(date))}
                        placeholder="Sin cambios"
                      />
                    )}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="newDueTime" className="text-xs text-on-surface-variant">
                    Hora
                  </Label>
                  <Input
                    id="newDueTime"
                    type="time"
                    className="w-32"
                    {...register('newDueTime')}
                  />
                </div>
              </div>
              <p className="text-xs text-on-surface-variant">
                Si no eliges día, la fecha límite se queda como está.
              </p>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={rejectReview.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" disabled={rejectReview.isPending}>
              {rejectReview.isPending ? <Loader2 className="animate-spin" /> : <ThumbsDown />}
              Rechazar revisión
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
