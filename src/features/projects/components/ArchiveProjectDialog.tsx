import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { useArchiveProject } from '../hooks/use-projects';
import type { Project } from '../types/project';

interface ArchiveProjectDialogProps {
  project: Project | null;
  onOpenChange: (open: boolean) => void;
}

export function ArchiveProjectDialog({
  project,
  onOpenChange,
}: ArchiveProjectDialogProps) {
  const archiveMutation = useArchiveProject();
  const errorMessage =
    archiveMutation.error instanceof Error ? archiveMutation.error.message : '';

  const handleConfirm = () => {
    if (!project) return;
    archiveMutation.mutate(project.id, {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={!!project} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Archivar proyecto</DialogTitle>
          <DialogDescription>
            ¿Seguro que quieres archivar{' '}
            <span className="font-medium text-on-surface">
              {project?.name}
            </span>
            ? No se elimina; podrás verlo en la vista de archivados.
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <div className="rounded-lg border border-error/20 bg-error-container px-4 py-3 text-sm font-medium text-on-error-container">
            {errorMessage}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={archiveMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={archiveMutation.isPending}
          >
            {archiveMutation.isPending && <Loader2 className="animate-spin" />}
            Archivar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
