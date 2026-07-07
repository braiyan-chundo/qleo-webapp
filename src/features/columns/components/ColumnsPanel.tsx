import { useState } from 'react';
import { toast } from 'sonner';
import {
  ChevronDown,
  ChevronUp,
  Columns3,
  Loader2,
  Pencil,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';

import { ApiError } from '@/core/api/fetch-client';
import { Badge } from '@/components/ui/badge';
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
  useColumns,
  useCreateColumn,
  useDeleteColumn,
  useReorderColumns,
  useUpdateColumn,
} from '../hooks/use-columns';
import type { Column } from '../services/columns.service';

interface ColumnsPanelProps {
  projectId: string;
}

/** Panel de gestión de columnas de estado (QL-06) dentro del detalle de proyecto. */
export function ColumnsPanel({ projectId }: ColumnsPanelProps) {
  const { data: columns, isLoading, isError, error } = useColumns(projectId);

  const createColumn = useCreateColumn(projectId);
  const updateColumn = useUpdateColumn(projectId);
  const reorderColumns = useReorderColumns(projectId);
  const deleteColumn = useDeleteColumn(projectId);

  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [toDelete, setToDelete] = useState<Column | null>(null);

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    createColumn.mutate(
      { name },
      {
        onSuccess: () => {
          setNewName('');
          toast.success('Columna creada');
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'No se pudo crear la columna');
        },
      },
    );
  };

  const startEditing = (column: Column) => {
    setEditingId(column.id);
    setEditingName(column.name);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName('');
  };

  const saveEditing = (column: Column) => {
    const name = editingName.trim();
    if (!name || name === column.name) {
      cancelEditing();
      return;
    }
    updateColumn.mutate(
      { id: column.id, data: { name } },
      {
        onSuccess: () => {
          cancelEditing();
          toast.success('Columna renombrada');
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'No se pudo renombrar la columna');
        },
      },
    );
  };

  const setDefault = (column: Column) => {
    if (column.isDefault) return;
    updateColumn.mutate(
      { id: column.id, data: { isDefault: true } },
      {
        onSuccess: () => toast.success(`"${column.name}" es ahora la columna por defecto`),
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'No se pudo marcar por defecto');
        },
      },
    );
  };

  const move = (index: number, direction: -1 | 1) => {
    if (!columns) return;
    const target = index + direction;
    if (target < 0 || target >= columns.length) return;
    const orderedIds = columns.map((c) => c.id);
    [orderedIds[index], orderedIds[target]] = [orderedIds[target], orderedIds[index]];
    reorderColumns.mutate(orderedIds, {
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'No se pudo reordenar');
      },
    });
  };

  const confirmDelete = () => {
    if (!toDelete) return;
    deleteColumn.mutate(toDelete.id, {
      onSuccess: () => {
        setToDelete(null);
        toast.success('Columna eliminada');
      },
      onError: (err) => {
        setToDelete(null);
        if (err instanceof ApiError && err.code === 'COLUMN_HAS_TASKS') {
          toast.error('No se puede eliminar una columna que tiene tareas.');
          return;
        }
        toast.error(err instanceof Error ? err.message : 'No se pudo eliminar la columna');
      },
    });
  };

  return (
    <section className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-5">
      <header className="mb-4 flex items-center gap-2">
        <Columns3 className="size-5 text-primary" />
        <h2 className="text-base font-semibold text-on-surface">Columnas de estado</h2>
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
          placeholder="Nueva columna…"
          aria-label="Nombre de la nueva columna"
        />
        <Button type="submit" size="sm" disabled={!newName.trim() || createColumn.isPending}>
          {createColumn.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
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
          {error instanceof Error ? error.message : 'No se pudieron cargar las columnas'}
        </div>
      )}

      {!isLoading && !isError && columns && columns.length === 0 && (
        <p className="rounded-lg border border-dashed border-outline-variant/60 px-4 py-8 text-center text-sm text-on-surface-variant">
          Aún no hay columnas — añade la primera (será la columna por defecto).
        </p>
      )}

      {!isLoading && !isError && columns && columns.length > 0 && (
        <ul className="space-y-2">
          {columns.map((column, index) => {
            const isEditing = editingId === column.id;
            return (
              <li
                key={column.id}
                className="flex items-center gap-2 rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2"
              >
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0 || reorderColumns.isPending}
                    aria-label="Subir columna"
                    className="text-on-surface-variant transition-colors hover:text-on-surface disabled:opacity-30"
                  >
                    <ChevronUp className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === columns.length - 1 || reorderColumns.isPending}
                    aria-label="Bajar columna"
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
                        saveEditing(column);
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        cancelEditing();
                      }
                    }}
                    onBlur={() => saveEditing(column)}
                    aria-label="Nuevo nombre de la columna"
                    className="h-8"
                  />
                ) : (
                  <button
                    type="button"
                    onDoubleClick={() => startEditing(column)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    title="Doble clic para renombrar"
                  >
                    <span className="truncate text-sm font-medium text-on-surface">
                      {column.name}
                    </span>
                    {column.isDefault && (
                      <Badge className="shrink-0">Por defecto</Badge>
                    )}
                  </button>
                )}

                {!isEditing && (
                  <div className="flex items-center gap-1">
                    {!column.isDefault && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDefault(column)}
                        disabled={updateColumn.isPending}
                        aria-label="Marcar como columna por defecto"
                        title="Marcar como por defecto"
                        className="text-on-surface-variant hover:text-primary"
                      >
                        <Star className="size-4" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => startEditing(column)}
                      aria-label="Renombrar columna"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setToDelete(column)}
                      aria-label="Eliminar columna"
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
            <AlertDialogTitle>Eliminar columna</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Seguro que quieres eliminar{' '}
              <span className="font-medium text-on-surface">{toDelete?.name}</span>?
              {toDelete?.isDefault
                ? ' Es la columna por defecto; el sistema promoverá otra automáticamente.'
                : ' Esta acción no se puede deshacer.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteColumn.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleteColumn.isPending}
            >
              {deleteColumn.isPending && <Loader2 className="animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
