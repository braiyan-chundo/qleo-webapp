import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { StagesPanel } from '@/features/stages/components/StagesPanel';
import { ColumnsPanel } from '@/features/columns/components/ColumnsPanel';
import { useProject } from '@/features/projects/hooks/use-projects';
import { canManageProject } from '@/features/projects/utils/permissions';
import { useAuthStore } from '@/store/auth.store';

import { BoardConfigPanel } from './BoardConfigPanel';

interface BoardSettingsDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Configuración del tablero fuera del flujo principal (board-first): un diálogo que agrupa
 * las etapas (QL-05) y las columnas de estado (QL-06) para no dominar la vista del board.
 * Añade (QL-63) un bloque de configuración (Backlog/inicio/fin/plantilla) visible para quien
 * puede gestionar el proyecto (`canManageProject`: ADMIN, creador o gestor otorgado) — la MISMA
 * regla que gatea el botón que abre este diálogo; el backend valida igual.
 */
export function BoardSettingsDialog({
  projectId,
  open,
  onOpenChange,
}: BoardSettingsDialogProps) {
  const user = useAuthStore((s) => s.user);
  // Solo se consulta el proyecto con el diálogo abierto (evita fetch en cada render del board).
  const { data: project } = useProject(open ? projectId : undefined);

  const canManage = canManageProject(project, user);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* `DialogContent` es una rejilla (`display:grid`): sus hijos tienen `min-width:auto`, así
          que su min-content actúa de suelo para la pista y el contenido desbordaba a lo ancho en
          móvil (QL-123). `min-w-0` en los hijos deja que la pista se ajuste al ancho real del
          diálogo; los paneles ya no aplastan sus filas (ver `StagesPanel`/`ColumnsPanel`). */}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader className="min-w-0">
          <DialogTitle>Configurar tablero</DialogTitle>
          <DialogDescription>
            Define las etapas del proyecto y las columnas de estado del Kanban.
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-4">
          {canManage && project && <BoardConfigPanel project={project} />}

          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            <StagesPanel projectId={projectId} />
            <ColumnsPanel projectId={projectId} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
