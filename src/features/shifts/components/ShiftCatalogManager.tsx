import { useState } from 'react';
import { toast } from 'sonner';
import { Clock, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { cn } from '@/lib/utils';

import { useDeleteShift, useShifts } from '../hooks/use-shifts';
import type { Shift } from '../services/shifts.service';
import { formatShiftHours } from '../lib/shift';
import { ShiftFormDialog } from './ShiftFormDialog';

/**
 * Gestión del **catálogo global de turnos** (QL-163, §3.46, solo ADMIN). Es el contenido del tab
 * "Turnos" del Calendario ADMIN. Lista TODOS los turnos (incluidos los retirados) con su nombre,
 * horario, color y estado, y permite crear/editar/borrar. El catálogo es pequeño → se trae
 * completo y se refresca en vivo por el bus realtime `shift`.
 */
export function ShiftCatalogManager() {
  const { data: shifts, isLoading, isError, error } = useShifts(true);
  const deleteShift = useDeleteShift();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Shift | null>(null);
  const [deleting, setDeleting] = useState<Shift | null>(null);

  const openCreate = () => {
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (shift: Shift) => {
    setEditing(shift);
    setShowForm(true);
  };

  const handleDelete = () => {
    if (!deleting) return;
    deleteShift.mutate(deleting.id, {
      onSuccess: () => {
        toast.success('Turno eliminado.');
        setDeleting(null);
      },
      onError: (err) => {
        setDeleting(null);
        toast.error(err instanceof Error ? err.message : 'No se pudo eliminar el turno.');
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-on-surface">Catálogo de turnos</h2>
          <p className="mt-0.5 text-sm text-on-surface-variant">
            Franjas horarias reutilizables. Un descanso se modela como el hueco entre dos turnos.
          </p>
        </div>
        <Button onClick={openCreate} className="h-10">
          <Plus />
          Nuevo turno
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-error/20 bg-error-container px-6 py-10 text-center">
          <p className="text-sm font-medium text-on-error-container">
            No se pudo cargar el catálogo de turnos
          </p>
          <p className="mt-1 text-xs text-on-error-container/80">
            {error instanceof Error ? error.message : 'Error desconocido'}
          </p>
        </div>
      ) : (shifts ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant/60 bg-surface-container-low px-6 py-16 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-primary-container text-primary">
            <Clock className="size-7" />
          </div>
          <h3 className="text-lg font-semibold text-on-surface">Aún no hay turnos</h3>
          <p className="mt-1 max-w-sm text-sm text-on-surface-variant">
            Crea el primer turno del catálogo para poder asignarlo en las mallas horarias.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-outline-variant/40 overflow-hidden rounded-xl border border-outline-variant/50 bg-surface-container-low">
          {(shifts ?? []).map((shift) => (
            <li
              key={shift.id}
              className={cn(
                'flex flex-wrap items-center gap-3 px-4 py-3',
                !shift.active && 'opacity-70',
              )}
            >
              <span
                className="size-4 shrink-0 rounded-full border border-outline-variant/60"
                style={{ backgroundColor: shift.color ?? 'var(--color-surface-container-highest)' }}
                aria-hidden
              />
              <div className="min-w-0">
                <p className="truncate font-medium text-on-surface">{shift.name}</p>
                <p className="text-sm tabular-nums text-on-surface-variant">
                  {formatShiftHours(shift)}
                </p>
              </div>

              {shift.active ? (
                <Badge variant="outline" className="border-tertiary/40 text-tertiary">
                  Activo
                </Badge>
              ) : (
                <Badge variant="outline" className="text-on-surface-variant">
                  Retirado
                </Badge>
              )}

              <div className="ml-auto flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-on-surface-variant"
                  onClick={() => openEdit(shift)}
                  aria-label={`Editar ${shift.name}`}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-on-surface-variant hover:text-error"
                  onClick={() => setDeleting(shift)}
                  aria-label={`Eliminar ${shift.name}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ShiftFormDialog open={showForm} shift={editing} onOpenChange={setShowForm} />

      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar turno?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? `Se eliminará el turno "${deleting.name}". Las mallas que lo usen dejarán de mostrarlo. Esta acción no se puede deshacer.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteShift.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleteShift.isPending}
            >
              {deleteShift.isPending && <Loader2 className="animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
