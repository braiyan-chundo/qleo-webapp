import { useState } from 'react';
import { toast } from 'sonner';
import {
  ChevronDown,
  ChevronUp,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
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
  useCreateStage,
  useDeleteStage,
  useRenameStage,
  useReorderStages,
  useStages,
} from '../hooks/use-stages';
import type { Stage } from '../services/stages.service';

interface StagesPanelProps {
  projectId: string;
}

/** Panel de gestión de etapas (QL-05) dentro del detalle de proyecto. */
export function StagesPanel({ projectId }: StagesPanelProps) {
  const { data: stages, isLoading, isError, error } = useStages(projectId);

  const createStage = useCreateStage(projectId);
  const renameStage = useRenameStage(projectId);
  const reorderStages = useReorderStages(projectId);
  const deleteStage = useDeleteStage(projectId);

  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [toDelete, setToDelete] = useState<Stage | null>(null);

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    createStage.mutate(
      { name },
      {
        onSuccess: () => {
          setNewName('');
          toast.success('Etapa creada');
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'No se pudo crear la etapa');
        },
      },
    );
  };

  const startEditing = (stage: Stage) => {
    setEditingId(stage.id);
    setEditingName(stage.name);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName('');
  };

  const saveEditing = (stage: Stage) => {
    const name = editingName.trim();
    if (!name || name === stage.name) {
      cancelEditing();
      return;
    }
    renameStage.mutate(
      { id: stage.id, data: { name } },
      {
        onSuccess: () => {
          cancelEditing();
          toast.success('Etapa renombrada');
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'No se pudo renombrar la etapa');
        },
      },
    );
  };

  const move = (index: number, direction: -1 | 1) => {
    if (!stages) return;
    const target = index + direction;
    if (target < 0 || target >= stages.length) return;
    const orderedIds = stages.map((s) => s.id);
    [orderedIds[index], orderedIds[target]] = [orderedIds[target], orderedIds[index]];
    reorderStages.mutate(orderedIds, {
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'No se pudo reordenar');
      },
    });
  };

  const confirmDelete = () => {
    if (!toDelete) return;
    const stage = toDelete;
    deleteStage.mutate(stage.id, {
      onSuccess: () => {
        setToDelete(null);
        toast.success('Etapa eliminada');
      },
      onError: (err) => {
        setToDelete(null);
        toast.error(err instanceof Error ? err.message : 'No se pudo eliminar la etapa');
      },
    });
  };

  return (
    <section className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-5">
      <header className="mb-4 flex items-center gap-2">
        <Layers className="size-5 text-primary" />
        <h2 className="text-base font-semibold text-on-surface">Etapas</h2>
      </header>

      {/* Añadir */}
      <form
        className="mb-4 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          handleCreate();
        }}
      >
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nueva etapa…"
          aria-label="Nombre de la nueva etapa"
        />
        <Button type="submit" size="sm" disabled={!newName.trim() || createStage.isPending}>
          {createStage.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
          Añadir
        </Button>
      </form>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded-lg" />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-lg border border-error/20 bg-error-container px-4 py-3 text-sm font-medium text-on-error-container">
          {error instanceof Error ? error.message : 'No se pudieron cargar las etapas'}
        </div>
      )}

      {!isLoading && !isError && stages && stages.length === 0 && (
        <p className="rounded-lg border border-dashed border-outline-variant/60 px-4 py-8 text-center text-sm text-on-surface-variant">
          Aún no hay etapas — añade la primera.
        </p>
      )}

      {!isLoading && !isError && stages && stages.length > 0 && (
        <ul className="space-y-2">
          {stages.map((stage, index) => {
            const isEditing = editingId === stage.id;
            return (
              <li
                key={stage.id}
                className="flex items-center gap-2 rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2"
              >
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0 || reorderStages.isPending}
                    aria-label="Subir etapa"
                    className="text-on-surface-variant transition-colors hover:text-on-surface disabled:opacity-30"
                  >
                    <ChevronUp className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === stages.length - 1 || reorderStages.isPending}
                    aria-label="Bajar etapa"
                    className="text-on-surface-variant transition-colors hover:text-on-surface disabled:opacity-30"
                  >
                    <ChevronDown className="size-4" />
                  </button>
                </div>

                {isEditing ? (
                  <Input
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        saveEditing(stage);
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        cancelEditing();
                      }
                    }}
                    onBlur={() => saveEditing(stage)}
                    aria-label="Nuevo nombre de la etapa"
                    className="h-8"
                  />
                ) : (
                  <button
                    type="button"
                    onDoubleClick={() => startEditing(stage)}
                    className="min-w-0 flex-1 truncate text-left text-sm font-medium text-on-surface"
                    title="Doble clic para renombrar"
                  >
                    {stage.name}
                  </button>
                )}

                {!isEditing && (
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => startEditing(stage)}
                      aria-label="Renombrar etapa"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setToDelete(stage)}
                      aria-label="Eliminar etapa"
                      className="text-on-surface-variant hover:text-error"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog
        open={!!toDelete}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar etapa</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Seguro que quieres eliminar{' '}
              <span className="font-medium text-on-surface">{toDelete?.name}</span>? Esta
              acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteStage.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleteStage.isPending}
            >
              {deleteStage.isPending && <Loader2 className="animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
