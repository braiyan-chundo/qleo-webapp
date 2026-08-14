import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { BadgeCheck, Loader2 } from 'lucide-react';

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

import { useApproveOpenEnded } from '../../hooks/use-tasks';
import {
  OPEN_ENDED_REASON_MAX,
  approveOpenEndedSchema,
  type ApproveOpenEndedValues,
} from '../../schemas/task.schema';
import type { Task } from '../../services/tasks.service';
import { isOpenEndedAlreadyResolved, taskDateErrorMessage } from '../../lib/open-ended';

interface ApproveOpenEndedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task;
  projectId: string;
}

/**
 * (QL-197, §3.69) Diálogo con el que **Dirección autoriza** dejar la fecha de fin abierta. Es el
 * gemelo del visto bueno de cierre (QL-171): comentario **opcional** (máx 500), y sin texto se
 * envía el POST sin body.
 *
 * Tras autorizar, la tarea se desbloquea y su falta de `dueDate` pasa a ser legítima: deja de
 * generar avisos de vencimiento y no cuenta como vencida.
 */
export function ApproveOpenEndedDialog({
  open,
  onOpenChange,
  task,
  projectId,
}: ApproveOpenEndedDialogProps) {
  const approve = useApproveOpenEnded(projectId, task.id);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ApproveOpenEndedValues>({
    resolver: zodResolver(approveOpenEndedSchema),
    defaultValues: { comment: '' },
  });

  // Limpia el formulario cada vez que se reabre el diálogo.
  useEffect(() => {
    if (open) reset({ comment: '' });
  }, [open, reset]);

  const onSubmit = (values: ApproveOpenEndedValues) => {
    const comment = values.comment?.trim();
    approve.mutate(comment ? { comment } : undefined, {
      onSuccess: () => {
        toast.success('Fin abierto autorizado. La tarea queda desbloqueada.');
        onOpenChange(false);
      },
      onError: (err) => {
        // (QL-197) Con tres personas en Dirección, que otra se haya adelantado es lo normal, no
        // un borde: se cierra el diálogo — el `onSettled` del hook ya trajo el estado real.
        if (isOpenEndedAlreadyResolved(err)) {
          toast.error('Esta solicitud ya estaba resuelta: otra persona respondió antes.');
          onOpenChange(false);
          return;
        }
        toast.error(
          taskDateErrorMessage(err) ??
            (err instanceof Error ? err.message : 'No se pudo autorizar el fin abierto'),
        );
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Autorizar fin abierto</DialogTitle>
            <DialogDescription>
              <span className="font-medium">{task.title}</span> podrá seguir adelante sin fecha
              de finalización. Se desbloquea y no generará avisos de vencimiento.
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
            <Label htmlFor="approveComment" className="text-xs text-on-surface-variant">
              Comentario (opcional)
            </Label>
            <Textarea
              id="approveComment"
              rows={3}
              maxLength={OPEN_ENDED_REASON_MAX}
              placeholder="Condiciones, plazos de revisión…"
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
              disabled={approve.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={approve.isPending}>
              {approve.isPending ? <Loader2 className="animate-spin" /> : <BadgeCheck />}
              Autorizar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
