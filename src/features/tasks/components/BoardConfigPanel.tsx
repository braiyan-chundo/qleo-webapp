import { useState } from 'react';
import { toast } from 'sonner';
import { Flag, FlagTriangleRight, Inbox, LayoutTemplate, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
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

import type { Project } from '@/features/projects/types/project';
import { useUpdateProject } from '@/features/projects/hooks/use-projects';
import {
  useApplyColumnTemplate,
  useColumns,
  useUpdateColumn,
} from '@/features/columns/hooks/use-columns';
import type {
  Column,
  UpdateColumnPayload,
} from '@/features/columns/services/columns.service';

interface BoardConfigPanelProps {
  project: Project;
}

/** Valor sentinela para "ninguna columna" en los selects de inicio/fin. */
const NONE = '';

/**
 * (QL-63) Configuración del tablero, **solo para el creador/ADMIN** (el consumidor la muestra
 * bajo `canManage`; el backend valida igual). Reúne tres ajustes de QL-61/QL-62:
 * - Visibilidad del Backlog a los miembros (`Project.showBacklogToMembers`).
 * - Columnas de inicio (`isStart`) y fin (`isEnd`) del flujo — permiten "ninguna".
 * - Acción idempotente "Usar plantilla básica" (añade Por hacer/En progreso/Hecho).
 */
export function BoardConfigPanel({ project }: BoardConfigPanelProps) {
  const { data: columns, isLoading } = useColumns(project.id);
  const updateProject = useUpdateProject();
  const updateColumn = useUpdateColumn(project.id);
  const applyTemplate = useApplyColumnTemplate(project.id);

  const [confirmTemplate, setConfirmTemplate] = useState(false);

  const startColumn = columns?.find((c) => c.isStart);
  const endColumn = columns?.find((c) => c.isEnd);

  const toggleBacklog = (next: boolean) => {
    updateProject.mutate(
      { id: project.id, data: { showBacklogToMembers: next } },
      {
        onSuccess: () =>
          toast.success(
            next
              ? 'El Backlog es visible para los miembros'
              : 'El Backlog queda oculto para los miembros',
          ),
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : 'No se pudo actualizar el proyecto',
          ),
      },
    );
  };

  /**
   * Cambia la columna marcada como inicio/fin. Marcar una nueva basta con un solo PATCH
   * (`{ isStart:true }`): el backend desmarca la anterior. "Ninguna" desmarca la actual.
   */
  const setBoundary = (
    kind: 'isStart' | 'isEnd',
    current: Column | undefined,
    nextId: string,
  ) => {
    const currentId = current?.id ?? NONE;
    if (nextId === currentId) return;

    const label = kind === 'isStart' ? 'inicio' : 'fin';
    const onError = (err: unknown) =>
      toast.error(
        err instanceof Error ? err.message : `No se pudo cambiar la columna de ${label}`,
      );

    if (nextId === NONE) {
      if (!current) return;
      const data: UpdateColumnPayload =
        kind === 'isStart' ? { isStart: false } : { isEnd: false };
      updateColumn.mutate(
        { id: current.id, data },
        {
          onSuccess: () => toast.success(`Columna de ${label} desactivada`),
          onError,
        },
      );
      return;
    }

    const data: UpdateColumnPayload =
      kind === 'isStart' ? { isStart: true } : { isEnd: true };
    updateColumn.mutate(
      { id: nextId, data },
      {
        onSuccess: () => toast.success(`Columna de ${label} actualizada`),
        onError,
      },
    );
  };

  const runTemplate = () => {
    applyTemplate.mutate(undefined, {
      onSuccess: () => {
        setConfirmTemplate(false);
        toast.success('Plantilla básica aplicada');
      },
      onError: (err) => {
        setConfirmTemplate(false);
        toast.error(
          err instanceof Error ? err.message : 'No se pudo aplicar la plantilla',
        );
      },
    });
  };

  const columnsDisabled = isLoading || updateColumn.isPending;

  return (
    <section className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-5">
      <header className="mb-4 flex items-center gap-2">
        <LayoutTemplate className="size-5 text-primary" />
        <h2 className="text-base font-semibold text-on-surface">Configuración del tablero</h2>
      </header>

      {/* Visibilidad del Backlog */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Label
            htmlFor="show-backlog"
            className="flex items-center gap-1.5 text-sm font-medium text-on-surface"
          >
            <Inbox className="size-4 text-on-surface-variant" />
            Mostrar Backlog a los miembros
          </Label>
          <p className="mt-1 text-xs text-on-surface-variant">
            Si se desactiva, la columna Backlog y sus tareas se ocultan a los miembros que no
            sean el creador ni administrador.
          </p>
        </div>
        <Switch
          id="show-backlog"
          checked={project.showBacklogToMembers}
          onCheckedChange={toggleBacklog}
          disabled={updateProject.isPending}
          aria-label="Mostrar Backlog a los miembros"
        />
      </div>

      <div className="my-4 h-px bg-outline-variant/40" />

      {/* Columnas de inicio / fin */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label
              htmlFor="start-column"
              className="flex items-center gap-1.5 text-sm font-medium text-on-surface"
            >
              <Flag className="size-4 text-tertiary" />
              Columna de inicio
            </Label>
            <NativeSelect
              id="start-column"
              className="w-full [&>select]:h-10"
              disabled={columnsDisabled}
              value={startColumn?.id ?? NONE}
              onChange={(e) => setBoundary('isStart', startColumn, e.target.value)}
            >
              <NativeSelectOption value={NONE}>Ninguna</NativeSelectOption>
              {columns?.map((column) => (
                <NativeSelectOption key={column.id} value={column.id}>
                  {column.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <p className="text-xs text-on-surface-variant">
              Al mover una tarea aquí se marca su inicio.
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label
              htmlFor="end-column"
              className="flex items-center gap-1.5 text-sm font-medium text-on-surface"
            >
              <FlagTriangleRight className="size-4 text-primary" />
              Columna de fin
            </Label>
            <NativeSelect
              id="end-column"
              className="w-full [&>select]:h-10"
              disabled={columnsDisabled}
              value={endColumn?.id ?? NONE}
              onChange={(e) => setBoundary('isEnd', endColumn, e.target.value)}
            >
              <NativeSelectOption value={NONE}>Ninguna</NativeSelectOption>
              {columns?.map((column) => (
                <NativeSelectOption key={column.id} value={column.id}>
                  {column.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <p className="text-xs text-on-surface-variant">
              Al mover una tarea aquí se marca que terminó.
            </p>
          </div>
        </div>
      )}

      <div className="my-4 h-px bg-outline-variant/40" />

      {/* Plantilla básica */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-on-surface">Usar plantilla básica</p>
          <p className="mt-1 text-xs text-on-surface-variant">
            Añade las columnas Por hacer, En progreso y Hecho que falten (no duplica ni cambia
            la columna por defecto).
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setConfirmTemplate(true)}
          disabled={applyTemplate.isPending}
        >
          {applyTemplate.isPending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <LayoutTemplate className="size-4" />
          )}
          Usar plantilla básica
        </Button>
      </div>

      <AlertDialog
        open={confirmTemplate}
        onOpenChange={(open) => {
          if (!open) setConfirmTemplate(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usar plantilla básica</AlertDialogTitle>
            <AlertDialogDescription>
              Se añadirán las columnas <span className="font-medium text-on-surface">Por
              hacer</span>, <span className="font-medium text-on-surface">En progreso</span> y{' '}
              <span className="font-medium text-on-surface">Hecho</span> que aún no existan. Es
              una acción segura y repetible: no duplica columnas ni cambia la columna por
              defecto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={applyTemplate.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                runTemplate();
              }}
              disabled={applyTemplate.isPending}
            >
              {applyTemplate.isPending && <Loader2 className="animate-spin" />}
              Aplicar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
