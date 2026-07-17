import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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

import { useDeleteLabel } from '../hooks/use-labels';
import type { Label } from '../services/labels.service';
import { LabelChip } from './LabelChip';

interface DeleteLabelDialogProps {
  /** Etiqueta a borrar; `null` mantiene el diálogo cerrado. */
  label: Label | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Confirmación de **borrado en cascada** de una etiqueta del catálogo global (QL-149, §3.38).
 *
 * El backend la quita de `project.labelIds` y `task.labelIds` de TODO lo que la referenciaba, así
 * que la acción es **irreversible** y afecta a proyectos y tareas ajenos. Para solo ocultarla sin
 * romper referencias existe "Archivar" (`PATCH { archived: true }`), que se ofrece aparte.
 */
export function DeleteLabelDialog({ label, onOpenChange }: DeleteLabelDialogProps) {
  const deleteLabel = useDeleteLabel();

  const handleConfirm = () => {
    if (!label) return;
    deleteLabel.mutate(label.id, {
      onSuccess: () => {
        toast.success(`Etiqueta "${label.name}" eliminada del catálogo.`);
        onOpenChange(false);
      },
      onError: (err) => {
        toast.error(
          err instanceof Error ? err.message : 'No se pudo eliminar la etiqueta.',
        );
      },
    });
  };

  return (
    <AlertDialog open={!!label} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar etiqueta</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span>Vas a eliminar</span>
                {label && <LabelChip label={label} />}
              </div>
              <p>
                Esto la <span className="font-medium text-on-surface">quita en cascada</span> de{' '}
                <span className="font-medium text-on-surface">todos</span> los proyectos y tareas
                que la usan. La acción es <span className="font-medium text-error">irreversible</span>.
              </p>
              <p>
                Si solo quieres ocultarla del selector sin tocar sus referencias, usa{' '}
                <span className="font-medium text-on-surface">Archivar</span> en su lugar.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteLabel.isPending}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={deleteLabel.isPending}
            className="bg-error text-on-error hover:bg-error/90"
          >
            {deleteLabel.isPending && <Loader2 className="animate-spin" />}
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
