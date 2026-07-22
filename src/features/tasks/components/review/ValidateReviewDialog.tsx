import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { BadgeCheck, Loader2 } from 'lucide-react';

import { ApiError } from '@/core/api/fetch-client';
import { Button } from '@/components/ui/button';
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

import { useValidateTask } from '../../hooks/use-tasks';
import {
  REVIEW_COMMENT_MAX,
  validateReviewSchema,
  type ValidateReviewValues,
} from '../../schemas/task.schema';
import type { Task } from '../../services/tasks.service';

interface ValidateReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task;
  projectId: string;
}

/**
 * (QL-171) Diálogo del **visto bueno**. Añade al flujo de QL-145 un comentario **opcional**
 * (máx 2000) que el backend guarda en `validationComment` y que luego se muestra junto a
 * "Validado por: {name}". Sin texto se envía el POST sin body, igual que antes.
 */
export function ValidateReviewDialog({
  open,
  onOpenChange,
  task,
  projectId,
}: ValidateReviewDialogProps) {
  const validateTask = useValidateTask(projectId, task.id);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ValidateReviewValues>({
    resolver: zodResolver(validateReviewSchema),
    defaultValues: { comment: '' },
  });

  // Limpia el formulario cada vez que se reabre el diálogo.
  useEffect(() => {
    if (open) reset({ comment: '' });
  }, [open, reset]);

  const onSubmit = (values: ValidateReviewValues) => {
    const comment = values.comment?.trim();
    validateTask.mutate(comment ? { comment } : undefined, {
      onSuccess: () => {
        toast.success('Tarea validada. El responsable ya puede cerrarla.');
        onOpenChange(false);
      },
      onError: (err) => {
        if (err instanceof ApiError && err.code === 'TASK_VALIDATION_FORBIDDEN') {
          toast.error('Solo el creador o un observador pueden validar la tarea.');
          return;
        }
        toast.error(err instanceof Error ? err.message : 'No se pudo validar la tarea');
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Validar tarea</DialogTitle>
            <DialogDescription>
              Das el visto bueno a <span className="font-medium">{task.title}</span> para que
              el responsable pueda cerrarla.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-1.5">
            <Label htmlFor="validationComment" className="text-xs text-on-surface-variant">
              Comentario (opcional)
            </Label>
            <Textarea
              id="validationComment"
              rows={3}
              maxLength={REVIEW_COMMENT_MAX}
              placeholder="Observaciones para el responsable…"
              className={cn(errors.comment && 'border-error')}
              {...register('comment')}
            />
            {errors.comment && (
              <span className="text-xs font-medium text-error">{errors.comment.message}</span>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={validateTask.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={validateTask.isPending}>
              {validateTask.isPending ? <Loader2 className="animate-spin" /> : <BadgeCheck />}
              Validar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
