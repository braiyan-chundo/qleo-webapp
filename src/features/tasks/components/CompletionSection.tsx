import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  BadgeCheck,
  CheckCircle2,
  Clock,
  Loader2,
  RotateCcw,
  Send,
  ShieldCheck,
} from 'lucide-react';

import { ApiError } from '@/core/api/fetch-client';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
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

import {
  useCompleteTask,
  useReopenTask,
  useRequestReview,
  useValidateTask,
} from '../hooks/use-tasks';
import type { Task } from '../services/tasks.service';
import { formatDateTime } from '../lib/time';

interface CompletionSectionProps {
  task: Task;
  projectId: string;
}

/**
 * Sección "Cierre de tarea" (QL-17 RF-2.5 + gate de validación QL-145, §3.39).
 *
 * El Responsable (ASSIGNEE) que no es el Creador **no ve "Cerrar tarea"** hasta que la tarea
 * esté validada. El flujo por rol + `reviewStatus`:
 * - **ASSIGNEE** + `NONE` → botón **"Solicitar revisión"** (AlertDialog de confirmación).
 * - **ASSIGNEE** + `REQUESTED` → estado **"En revisión"** (sin poder cerrar).
 * - **ASSIGNEE** + `VALIDATED` → **"Validado por: {name}"** + panel de cierre normal.
 * - **CREATOR** / **OBSERVER** + `REQUESTED` → botón **"Validar"**.
 * - **CREATOR** (y ADMIN de plataforma) cierran directo, sin gate.
 * Si está completada, muestra el banner de cierre con quién/cuándo/resumen y el botón **Reabrir**.
 */
export function CompletionSection({ task, projectId }: CompletionSectionProps) {
  const role = task.currentUserRole;
  const isPlatformAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');

  const isCreator = role === 'CREATOR';
  const isAssignee = role === 'ASSIGNEE';
  const canValidate = role === 'CREATOR' || role === 'OBSERVER';
  // Quién puede completar/reabrir la tarea (igual que antes de QL-145).
  const canManage = isCreator || isAssignee;

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

          {task.validatedAt && task.validatedBy && (
            <ValidatedByLine name={task.validatedBy.name} at={task.validatedAt} className="mt-2" />
          )}

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
                tiempo cronometrado se conserva. Volverá a requerir el visto bueno para cerrarse.
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

  // ---- Tarea NO completada: acciones según rol + estado de validación (QL-145) ----
  const reviewStatus = task.reviewStatus;
  // El Responsable que no es Creador ni ADMIN de plataforma necesita el visto bueno para cerrar.
  const assigneeGated = isAssignee && !isPlatformAdmin;
  // ¿Ve el panel de cierre? CREATOR/ADMIN sin gate; el ASSIGNEE gateado solo si ya está VALIDATED.
  const canSeeClosePanel =
    isCreator || (isAssignee && (isPlatformAdmin || reviewStatus === 'VALIDATED'));
  // El Creador/Observador puede validar cuando el Responsable ya solicitó revisión.
  const showValidate = canValidate && reviewStatus === 'REQUESTED';

  // Roles sin nada que hacer aquí (COLLABORATOR, u OBSERVER sin revisión pendiente).
  if (!showValidate && !canSeeClosePanel && !assigneeGated) return null;

  return (
    <>
      <div className="space-y-3">
        {showValidate && <ValidatePanel task={task} projectId={projectId} />}

        {assigneeGated && reviewStatus === 'NONE' && (
          <RequestReviewPanel task={task} projectId={projectId} />
        )}

        {assigneeGated && reviewStatus === 'REQUESTED' && <InReviewPanel />}

        {canSeeClosePanel && (
          <section className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-4 py-3">
            {task.validatedAt && task.validatedBy && (
              <ValidatedByLine
                name={task.validatedBy.name}
                at={task.validatedAt}
                className="mb-2"
              />
            )}
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
        )}
      </div>

      <CompleteTaskDialog
        open={completeOpen}
        onOpenChange={setCompleteOpen}
        task={task}
        projectId={projectId}
      />
    </>
  );
}

interface ReviewPanelProps {
  task: Task;
  projectId: string;
}

/**
 * (QL-145) Panel del Responsable cuando aún no ha pedido el visto bueno: en vez de "Cerrar",
 * ofrece **"Solicitar revisión"** con un AlertDialog de confirmación.
 */
function RequestReviewPanel({ task, projectId }: ReviewPanelProps) {
  const [confirm, setConfirm] = useState(false);
  const requestReview = useRequestReview(projectId, task.id);

  const handleRequest = () => {
    requestReview.mutate(undefined, {
      onSuccess: () => {
        toast.success('Revisión solicitada. Se notificó al creador y a los observadores.');
        setConfirm(false);
      },
      onError: (err) => {
        setConfirm(false);
        if (err instanceof ApiError && err.code === 'REVIEW_REQUEST_FORBIDDEN') {
          toast.error('Solo el Responsable puede solicitar la revisión.');
          return;
        }
        toast.error(
          err instanceof Error ? err.message : 'No se pudo solicitar la revisión',
        );
      },
    });
  };

  return (
    <>
      <section className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-on-surface">Solicitar revisión</p>
            <p className="mt-0.5 text-xs text-on-surface-variant">
              Antes de cerrar, el creador o un observador debe dar el visto bueno.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => setConfirm(true)}
            disabled={requestReview.isPending}
          >
            {requestReview.isPending ? <Loader2 className="animate-spin" /> : <Send />}
            Solicitar revisión
          </Button>
        </div>
      </section>

      <AlertDialog
        open={confirm}
        onOpenChange={(o) => {
          if (!o) setConfirm(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Solicitar revisión</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción enviará la tarea para que el creador u observador la valide, ¿desea
              continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={requestReview.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleRequest();
              }}
              disabled={requestReview.isPending}
            >
              {requestReview.isPending && <Loader2 className="animate-spin" />}
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** (QL-145) Estado "En revisión" para el Responsable mientras espera el visto bueno. */
function InReviewPanel() {
  return (
    <section className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-4 py-3">
      <p className="inline-flex items-center gap-1.5 text-sm font-medium text-on-surface">
        <Clock className="size-4 text-on-surface-variant" />
        En revisión
      </p>
      <p className="mt-0.5 text-xs text-on-surface-variant">
        Esperando el visto bueno del creador o de un observador para poder cerrar la tarea.
      </p>
    </section>
  );
}

/**
 * (QL-145) Panel del Creador/Observador cuando el Responsable solicitó revisión: botón
 * **"Validar"** que da el visto bueno para habilitar el cierre.
 */
function ValidatePanel({ task, projectId }: ReviewPanelProps) {
  const validateTask = useValidateTask(projectId, task.id);

  const handleValidate = () => {
    validateTask.mutate(undefined, {
      onSuccess: () => {
        toast.success('Tarea validada. El responsable ya puede cerrarla.');
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
    <section className="rounded-lg border border-primary/30 bg-primary-container/50 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-on-primary-container">
            <ShieldCheck className="size-4" />
            Revisión solicitada
          </p>
          <p className="mt-0.5 text-xs text-on-primary-container/80">
            El responsable pide tu visto bueno para poder cerrar la tarea.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={handleValidate}
          disabled={validateTask.isPending}
        >
          {validateTask.isPending ? <Loader2 className="animate-spin" /> : <BadgeCheck />}
          Validar
        </Button>
      </div>
    </section>
  );
}

interface ValidatedByLineProps {
  name: string;
  at: string;
  className?: string;
}

/** (QL-145) Línea "Validado por: {name} · {fecha}". Se pinta cuando existe `validatedAt`. */
function ValidatedByLine({ name, at, className }: ValidatedByLineProps) {
  return (
    <p
      className={cn(
        'inline-flex flex-wrap items-center gap-1.5 text-xs font-medium text-tertiary',
        className,
      )}
    >
      <BadgeCheck className="size-3.5" />
      Validado por: {name}
      <span className="font-normal text-on-surface-variant">· {formatDateTime(at)}</span>
    </p>
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
            if (err.code === 'CLOSE_REQUIRES_VALIDATION') {
              // Carrera QL-145: la validación se limpió (p. ej. la reabrieron) antes de cerrar.
              toast.error(
                'La tarea necesita el visto bueno del creador u observador antes de cerrarse.',
              );
              onOpenChange(false);
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
