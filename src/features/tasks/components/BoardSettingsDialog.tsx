import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { StagesPanel } from '@/features/stages/components/StagesPanel';
import { ColumnsPanel } from '@/features/columns/components/ColumnsPanel';

interface BoardSettingsDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Configuración del tablero fuera del flujo principal (board-first): un diálogo que agrupa
 * las etapas (QL-05) y las columnas de estado (QL-06) para no dominar la vista del board.
 */
export function BoardSettingsDialog({
  projectId,
  open,
  onOpenChange,
}: BoardSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Configurar tablero</DialogTitle>
          <DialogDescription>
            Define las etapas del expediente y las columnas de estado del Kanban.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 lg:grid-cols-2">
          <StagesPanel projectId={projectId} />
          <ColumnsPanel projectId={projectId} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
