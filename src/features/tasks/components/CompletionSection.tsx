import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, RotateCcw } from 'lucide-react';

import { ApiError } from '@/core/api/fetch-client';
import { Button } from '@/components/ui/button';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { useCompleteTask, useReopenTask } from '../hooks/use-tasks';
import type { Task } from '../services/tasks.service';
import { formatDateTime } from '../lib/time';

interface CompletionSectionProps {
  task: Task;
  projectId: string;
}

/**
 * Sección "Cierre de tarea" (QL-17, RF-2.5). Si está completada, muestra un banner con quién
 * cerró, cuándo y el resumen, más el botón **Reabrir**. Si no, muestra el botón **Completar
 * tarea** que abre un diálogo con el resumen. Solo CREATOR/ASSIGNEE pueden completar/reabrir.
 */
export function CompletionSection({ task, projectId }: CompletionSectionProps) {
  const role = task.currentUserRole;
  const canManage = role === 'CREATOR' || role === 'ASSIGNEE';

  const [completeOpen, setCompleteOpen] = useState(false);
  const [confirmReopen, setConfirmReopen] = useState(false);

  const reopenTask = useReopenTask(projectId, task.id);

  const handleReopen = () => {
    reopenTask.mutate(undefined, {
      onSuccess: () => {
        toast.success('Tarea reabierta');
        setConfirmReopen(false);
      },
      onError: (err) => {
        setConfirmReopen(false);
        if (err instanceof ApiError && err.code === 'READ_ONLY_ROLE') {
          toast.error('Como Observador no puedes reabrir la tarea.');
          return;
        }
        toast.error(err instanceof Error ? err.message : 'No se pudo reabrir la tarea');
      },
    });
  };

  if (task.isCompleted) {
    return (
      <>
        <section className="rounded-lg border border-tertiary/30 bg-tertiary-container/60 px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-on-tertiary-container">
                <CheckCircle2 className="size-4" />
                Tarea completada
              </p>
              <p className="mt-1 text-xs text-on-tertiary-container/80">
                {task.completedBy?.name ? `Por ${task.completedBy.name}` : 'Completada'}
                {task.completedAt && ` · ${formatDateTime(task.completedAt)}`}
              </p>
            </div>

            {canManage && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setConfirmReopen(true)}
                disabled={reopenTask.isPending}
              >
                {reopenTask.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <RotateCcw />
                )}
                Reabrir
              </Button>
            )}
          </div>

          <div className="mt-3 rounded-md bg-surface-container-lowest/70 px-3 py-2">
            <p className="text-xs font-medium text-on-surface-variant">
              Resumen de resultados
            </p>
            <p className="mt-1 text-sm whitespace-pre-wrap text-on-surface">
              {task.completionSummary?.trim() ||
                'Se cerró con archivos probatorios (sin resumen escrito).'}
            </p>
          </div>
        </section>

        <AlertDialog
          open={confirmReopen}
          onOpenChange={(o) => {
            if (!o) setConfirmReopen(false);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reabrir tarea</AlertDialogTitle>
              <AlertDialogDescription>
                La tarea volverá a estar en curso y se limpiará el resumen de cierre. El
                tiempo cronometrado se conserva.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={reopenTask.isPending}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleReopen();
                }}
                disabled={reopenTask.isPending}
              >
                {reopenTask.isPending && <Loader2 className="animate-spin" />}
                Reabrir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  // No completada: botón para completar (solo CREATOR/ASSIGNEE).
  if (!canManage) return null;

  return (
    <>
      <section className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-on-surface">Cerrar tarea</p>
            <p className="mt-0.5 text-xs text-on-surface-variant">
              Registra un resumen de resultados para marcarla como completada.
            </p>
          </div>
          <Button type="button" size="sm" onClick={() => setCompleteOpen(true)}>
            <CheckCircle2 />
            Completar tarea
          </Button>
        </div>
      </section>

      <CompleteTaskDialog
        open={completeOpen}
        onOpenChange={setCompleteOpen}
        task={task}
        projectId={projectId}
      />
    </>
  );
}

interface CompleteTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task;
  projectId: string;
}

/** Diálogo de cierre: textarea de resumen. El resumen es obligatorio salvo que haya adjuntos. */
function CompleteTaskDialog({
  open,
  onOpenChange,
  task,
  projectId,
}: CompleteTaskDialogProps) {
  const completeTask = useCompleteTask(projectId, task.id);
  const [summary, setSummary] = useState('');

  // Limpia el textarea al reabrir el diálogo.
  useEffect(() => {
    if (open) setSummary('');
  }, [open]);

  const handleComplete = () => {
    completeTask.mutate(
      { summary: summary.trim() || undefined },
      {
        onSuccess: () => {
          toast.success('Tarea completada');
          onOpenChange(false);
        },
        onError: (err) => {
          if (err instanceof ApiError) {
            if (err.code === 'MANDATORY_SUMMARY_REQUIRED') {
              toast.error(
                'Escribe un resumen o adjunta un archivo probatorio para completar la tarea.',
              );
              return;
            }
            if (err.code === 'READ_ONLY_ROLE') {
              toast.error('Como Observador no puedes completar la tarea.');
              return;
            }
          }
          toast.error(
            err instanceof Error ? err.message : 'No se pudo completar la tarea',
          );
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Completar tarea</DialogTitle>
          <DialogDescription>
            Describe los resultados de <span className="font-medium">{task.title}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-1.5">
          <Label htmlFor="completionSummary" className="text-xs text-on-surface-variant">
            Resumen de resultados
          </Label>
          <Textarea
            id="completionSummary"
            rows={5}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Qué se hizo, entregables, notas de cierre…"
            maxLength={5000}
          />
          <p className="text-xs text-on-surface-variant">
            Si no adjuntaste archivos probatorios, el resumen es obligatorio (RF-2.5).
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={completeTask.isPending}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={handleComplete} disabled={completeTask.isPending}>
            {completeTask.isPending && <Loader2 className="animate-spin" />}
            Completar tarea
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
