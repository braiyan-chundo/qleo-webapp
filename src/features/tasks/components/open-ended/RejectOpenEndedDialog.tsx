import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2, ThumbsDown } from 'lucide-react';

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

import { useRejectOpenEnded } from '../../hooks/use-tasks';
import {
  OPEN_ENDED_REASON_MAX,
  rejectOpenEndedSchema,
  type RejectOpenEndedValues,
} from '../../schemas/task.schema';
import type { Task } from '../../services/tasks.service';
import { isOpenEndedAlreadyResolved, taskDateErrorMessage } from '../../lib/open-ended';

interface RejectOpenEndedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task;
  projectId: string;
}

/**
 * (QL-197, §3.69) Diálogo con el que **Dirección deniega** el fin abierto. El motivo es
 * **obligatorio**, igual que al rechazar la revisión de cierre (QL-171): denegar sin decir por
 * qué deja la tarea bloqueada y al Creador sin saber qué corregir.
 *
 * Tras denegar, la tarea **sigue bloqueada**: la única salida es que alguien le ponga una fecha
 * de fin (eso cancela la solicitud entera en el backend). Se dice en el diálogo para que quien
 * deniega sepa qué le está pidiendo al Creador.
 */
export function RejectOpenEndedDialog({
  open,
  onOpenChange,
  task,
  projectId,
}: RejectOpenEndedDialogProps) {
  const reject = useRejectOpenEnded(projectId, task.id);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RejectOpenEndedValues>({
    resolver: zodResolver(rejectOpenEndedSchema),
    defaultValues: { comment: '' },
  });

  // Limpia el formulario cada vez que se reabre el diálogo (no arrastra el motivo anterior).
  useEffect(() => {
    if (open) reset({ comment: '' });
  }, [open, reset]);

  const onSubmit = (values: RejectOpenEndedValues) => {
    reject.mutate(
      { comment: values.comment.trim() },
      {
        onSuccess: () => {
          toast.success('Fin abierto denegado. Se notificó a quien lo pidió.');
          onOpenChange(false);
        },
        onError: (err) => {
          // (QL-197) Otro miembro de Dirección se adelantó: no se re-sella su decisión.
          if (isOpenEndedAlreadyResolved(err)) {
            toast.error('Esta solicitud ya estaba resuelta: otra persona respondió antes.');
            onOpenChange(false);
            return;
          }
          toast.error(
            taskDateErrorMessage(err) ??
              (err instanceof Error ? err.message : 'No se pudo denegar el fin abierto'),
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
            <DialogTitle>No autorizar el fin abierto</DialogTitle>
            <DialogDescription>
              <span className="font-medium">{task.title}</span> seguirá bloqueada hasta que
              alguien le ponga una fecha de finalización. Explica por qué para que puedan
              corregirlo.
            </DialogDescription>
          </DialogHeader>

          {task.openEndedReason?.trim() && (
            <div className="rounded-md border border-outline-variant/40 bg-surface-container-lowest px-3 py-2">
              <p className="text-xs font-medium text-on-surface-variant">
                Motivo que dio {task.openEndedRequestedBy?.name ?? 'el creador'}
              </p>
              <p className="mt-1 text-sm whitespace-pre-wrap text-on-surface">
                {task.openEndedReason}
              </p>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="rejectOpenEndedComment" className="text-xs text-on-surface-variant">
              Motivo <span className="text-error">*</span>
            </Label>
            <Textarea
              id="rejectOpenEndedComment"
              rows={4}
              maxLength={OPEN_ENDED_REASON_MAX}
              placeholder="Por qué esta tarea sí necesita una fecha de fin…"
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
              disabled={reject.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" disabled={reject.isPending}>
              {reject.isPending ? <Loader2 className="animate-spin" /> : <ThumbsDown />}
              No autorizar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
