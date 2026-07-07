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

import { useDeactivateUser } from '../hooks/use-users';
import type { UserSummary } from '../services/users.service';

interface DeactivateUserDialogProps {
  user: UserSummary | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Confirmación de desactivación de usuario (soft delete → `status: INACTIVE`).
 * No borra la cuenta: preserva la trazabilidad de sus tareas.
 */
export function DeactivateUserDialog({
  user,
  onOpenChange,
}: DeactivateUserDialogProps) {
  const deactivateMutation = useDeactivateUser();

  const handleConfirm = () => {
    if (!user) return;
    deactivateMutation.mutate(user.id, {
      onSuccess: () => {
        toast.success('Usuario desactivado.');
        onOpenChange(false);
      },
      onError: (err) => {
        toast.error(
          err instanceof Error ? err.message : 'No se pudo desactivar el usuario.',
        );
      },
    });
  };

  return (
    <AlertDialog open={!!user} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Desactivar usuario</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Seguro que quieres desactivar a{' '}
            <span className="font-medium text-on-surface">{user?.name}</span>? No
            podrá iniciar sesión, pero se conserva su historial de tareas. Podrás
            reactivarlo editándolo.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deactivateMutation.isPending}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={deactivateMutation.isPending}
            className="bg-error text-on-error hover:bg-error/90"
          >
            {deactivateMutation.isPending && (
              <Loader2 className="animate-spin" />
            )}
            Desactivar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
