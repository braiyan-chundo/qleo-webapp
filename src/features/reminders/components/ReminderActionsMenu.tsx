import { useState } from 'react';
import { MoreVertical, Pause, Pencil, Play, Trash2 } from 'lucide-react';

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
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ReminderActionsMenuProps {
  message: string;
  onEdit: () => void;
  /** `null` en un cumplido: no se pausa ni se reanuda (409 `REMINDER_FINISHED`). */
  pauseAction: 'pause' | 'resume' | null;
  onTogglePause: () => void;
  onDelete: () => void;
  disabled?: boolean;
}

/**
 * Menú ⋮ de un recordatorio (maqueta): Editar · Pausar/Reanudar · separador · Eliminar. Eliminar,
 * lejos de lo demás y con confirmación (AC-11).
 */
export function ReminderActionsMenu({
  message,
  onEdit,
  pauseAction,
  onTogglePause,
  onDelete,
  disabled,
}: ReminderActionsMenuProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={disabled}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Opciones del recordatorio"
            className="shrink-0 text-on-surface-variant max-md:size-11"
          >
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={onEdit} className="max-md:min-h-11">
            <Pencil />
            Editar
          </DropdownMenuItem>
          {pauseAction && (
            <DropdownMenuItem onSelect={onTogglePause} className="max-md:min-h-11">
              {pauseAction === 'pause' ? <Pause /> : <Play />}
              {pauseAction === 'pause' ? 'Pausar' : 'Reanudar'}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setConfirming(true)}
            className="max-md:min-h-11"
          >
            <Trash2 />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este recordatorio?</AlertDialogTitle>
            <AlertDialogDescription>
              «{message}» dejará de sonar y no se puede recuperar. Si tiene tarea, la tarea no
              cambia.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="max-md:h-11">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="max-md:h-11"
              onClick={() => {
                setConfirming(false);
                onDelete();
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
