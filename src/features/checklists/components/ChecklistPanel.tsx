import { useState } from 'react';
import { toast } from 'sonner';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

import { ApiError } from '@/core/api/fetch-client';
import type { TaskRole } from '@/features/tasks/services/tasks.service';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import type { ChecklistItem } from '../services/checklists.service';
import {
  useAddItem,
  useChecklist,
  useDeleteItem,
  useReorderChecklist,
  useToggleItem,
  useUpdateItem,
} from '../hooks/use-checklist';

interface ChecklistPanelProps {
  task: { id: string; currentUserRole: TaskRole | null };
}

/** Traduce cualquier fallo de checklist a un toast según §3.8 (READ_ONLY_ROLE / 403 genérico). */
function notifyError(err: unknown, fallback: string) {
  if (err instanceof ApiError) {
    if (err.code === 'READ_ONLY_ROLE') {
      toast.error('Tu rol es de solo lectura.');
      return;
    }
    toast.error(err.message);
    return;
  }
  toast.error(err instanceof Error ? err.message : fallback);
}

/**
 * Panel de checklist granular dentro del detalle de tarea (QL-11, §3.8). Deriva dos flags del
 * rol por tarea: `canToggle` (marcar) y `canEditStructure` (añadir/editar/reordenar/borrar) y
 * solo pinta controles permitidos para no provocar 403 evitables.
 */
export function ChecklistPanel({ task }: ChecklistPanelProps) {
  const role = task.currentUserRole;
  const canToggle =
    role === 'CREATOR' || role === 'ASSIGNEE' || role === 'COLLABORATOR';
  const canEditStructure = role === 'CREATOR' || role === 'ASSIGNEE';

  const { data: items, isLoading, isError, error } = useChecklist(task.id);
  const addItem = useAddItem(task.id);
  const toggleItem = useToggleItem(task.id);
  const reorder = useReorderChecklist(task.id);

  const [newText, setNewText] = useState('');

  const total = items?.length ?? 0;
  const done = items?.filter((i) => i.done).length ?? 0;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  const handleAdd = () => {
    const text = newText.trim();
    if (!text || addItem.isPending) return;
    addItem.mutate(
      { text },
      {
        onSuccess: () => setNewText(''),
        onError: (err) => notifyError(err, 'No se pudo añadir el ítem'),
      },
    );
  };

  const handleToggle = (item: ChecklistItem) => {
    toggleItem.mutate(
      { id: item.id },
      { onError: (err) => notifyError(err, 'No se pudo actualizar el ítem') },
    );
  };

  const handleMove = (index: number, direction: -1 | 1) => {
    if (!items || reorder.isPending) return;
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const orderedIds = items.map((i) => i.id);
    [orderedIds[index], orderedIds[target]] = [
      orderedIds[target],
      orderedIds[index],
    ];
    reorder.mutate(orderedIds, {
      onError: (err) => notifyError(err, 'No se pudo reordenar el checklist'),
    });
  };

  return (
    <div className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-4 py-3">
      <div className="flex items-center gap-2">
        <ListChecks className="size-4 text-on-surface-variant" />
        <p className="text-xs font-medium text-on-surface-variant">Checklist</p>
        {total > 0 && (
          <span className="ml-auto text-xs font-medium tabular-nums text-on-surface-variant">
            {done}/{total}
          </span>
        )}
      </div>

      {total > 0 && (
        <Progress value={percent} className="mt-2 h-1.5" aria-label="Progreso del checklist" />
      )}

      {isLoading && (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-6 w-full rounded-md" />
          <Skeleton className="h-6 w-4/5 rounded-md" />
          <Skeleton className="h-6 w-3/5 rounded-md" />
        </div>
      )}

      {isError && (
        <p className="mt-3 rounded-md border border-error/20 bg-error-container px-3 py-2 text-xs font-medium text-on-error-container">
          {error instanceof Error ? error.message : 'No se pudo cargar el checklist'}
        </p>
      )}

      {!isLoading && !isError && total === 0 && (
        <p className="mt-3 text-sm text-on-surface-variant">Sin ítems todavía.</p>
      )}

      {!isLoading && !isError && items && total > 0 && (
        <ul className="mt-3 space-y-1">
          {items.map((item, index) => (
            <ChecklistRow
              key={item.id}
              item={item}
              taskId={task.id}
              canToggle={canToggle}
              canEditStructure={canEditStructure}
              isFirst={index === 0}
              isLast={index === total - 1}
              reordering={reorder.isPending}
              onToggle={() => handleToggle(item)}
              onMoveUp={() => handleMove(index, -1)}
              onMoveDown={() => handleMove(index, 1)}
            />
          ))}
        </ul>
      )}

      {canEditStructure && !isError && (
        <div className="mt-3 flex items-center gap-2">
          <Input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder="Añadir un ítem…"
            className="h-9"
            disabled={addItem.isPending}
          />
          <Button
            type="button"
            size="sm"
            onClick={handleAdd}
            disabled={!newText.trim() || addItem.isPending}
          >
            {addItem.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
            Añadir
          </Button>
        </div>
      )}
    </div>
  );
}

interface ChecklistRowProps {
  item: ChecklistItem;
  taskId: string;
  canToggle: boolean;
  canEditStructure: boolean;
  isFirst: boolean;
  isLast: boolean;
  reordering: boolean;
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

/** Fila de un ítem: checkbox + texto (con edición en línea) + controles estructurales. */
function ChecklistRow({
  item,
  taskId,
  canToggle,
  canEditStructure,
  isFirst,
  isLast,
  reordering,
  onToggle,
  onMoveUp,
  onMoveDown,
}: ChecklistRowProps) {
  const updateItem = useUpdateItem(taskId);
  const deleteItem = useDeleteItem(taskId);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.text);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const startEdit = () => {
    setDraft(item.text);
    setEditing(true);
  };

  const commitEdit = () => {
    const text = draft.trim();
    if (!text || text === item.text) {
      setEditing(false);
      return;
    }
    updateItem.mutate(
      { id: item.id, data: { text } },
      {
        onSuccess: () => setEditing(false),
        onError: (err) => notifyError(err, 'No se pudo editar el ítem'),
      },
    );
  };

  const handleDelete = () => {
    deleteItem.mutate(item.id, {
      onSuccess: () => {
        setConfirmDelete(false);
        toast.success('Ítem eliminado');
      },
      onError: (err) => {
        setConfirmDelete(false);
        notifyError(err, 'No se pudo eliminar el ítem');
      },
    });
  };

  return (
    <li className="group/item flex items-center gap-2 rounded-md px-1 py-1 hover:bg-surface-container-high/60">
      <Checkbox
        checked={item.done}
        disabled={!canToggle}
        onCheckedChange={onToggle}
        aria-label={item.done ? 'Desmarcar ítem' : 'Marcar ítem'}
        className={cn(!canToggle && 'cursor-default opacity-100')}
      />

      {editing ? (
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitEdit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setEditing(false);
            }
          }}
          onBlur={commitEdit}
          disabled={updateItem.isPending}
          className="h-8 flex-1"
        />
      ) : (
        <span
          className={cn(
            'flex-1 text-sm break-words',
            item.done
              ? 'text-on-surface-variant/70 line-through'
              : 'text-on-surface',
            canEditStructure && 'cursor-text',
          )}
          onDoubleClick={canEditStructure ? startEdit : undefined}
        >
          {item.text}
        </span>
      )}

      {canEditStructure && !editing && !confirmDelete && (
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/item:opacity-100 focus-within:opacity-100">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onMoveUp}
            disabled={isFirst || reordering}
            aria-label="Subir ítem"
          >
            <ArrowUp className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onMoveDown}
            disabled={isLast || reordering}
            aria-label="Bajar ítem"
          >
            <ArrowDown className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={startEdit}
            aria-label="Editar ítem"
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 text-error hover:text-error"
            onClick={() => setConfirmDelete(true)}
            aria-label="Eliminar ítem"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      )}

      {editing && (
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onMouseDown={(e) => e.preventDefault()}
            onClick={commitEdit}
            disabled={updateItem.isPending}
            aria-label="Guardar"
          >
            {updateItem.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setEditing(false)}
            aria-label="Cancelar"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      )}

      {confirmDelete && (
        <div className="flex items-center gap-1">
          <span className="text-xs text-on-surface-variant">¿Eliminar?</span>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="h-7 px-2"
            onClick={handleDelete}
            disabled={deleteItem.isPending}
          >
            {deleteItem.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Sí
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => setConfirmDelete(false)}
            disabled={deleteItem.isPending}
          >
            No
          </Button>
        </div>
      )}
    </li>
  );
}
