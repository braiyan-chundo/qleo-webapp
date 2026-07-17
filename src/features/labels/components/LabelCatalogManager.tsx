import { useMemo, useState } from 'react';
import { Loader2, Plus, Search, Tags } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

import { useLabels, useUpdateLabel } from '../hooks/use-labels';
import type { Label } from '../services/labels.service';
import { LabelChip } from './LabelChip';
import { CreateLabelForm } from './CreateLabelForm';
import { EditLabelDialog } from './EditLabelDialog';
import { DeleteLabelDialog } from './DeleteLabelDialog';

/**
 * Gestión del **catálogo global de etiquetas** (QL-149, §3.38, solo ADMIN). Lista TODAS las
 * etiquetas —incluidas las archivadas— y permite crear, editar (nombre/icono/color/archivado) y
 * borrar en cascada. Es el contenido del tab "Etiquetas" de la vista de Configuración.
 *
 * El catálogo es un set pequeño y global, así que se trae completo una vez
 * (`includeArchived: true`) y se filtra/ordena en cliente; no se pagina.
 */
export function LabelCatalogManager() {
  const { data, isLoading, isError, error } = useLabels('', {
    includeArchived: true,
  });
  const updateLabel = useUpdateLabel();

  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Label | null>(null);
  const [deleting, setDeleting] = useState<Label | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const labels = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = data ?? [];
    const filtered = term
      ? list.filter((l) => l.name.toLowerCase().includes(term))
      : list;
    return [...filtered].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );
  }, [data, search]);

  const toggleArchived = (label: Label) => {
    setTogglingId(label.id);
    updateLabel.mutate(
      { id: label.id, data: { archived: !label.archived } },
      {
        onSuccess: () => {
          toast.success(
            label.archived ? 'Etiqueta reactivada.' : 'Etiqueta archivada.',
          );
        },
        onError: (err) => {
          toast.error(
            err instanceof Error
              ? err.message
              : 'No se pudo cambiar el estado de la etiqueta.',
          );
        },
        onSettled: () => setTogglingId(null),
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-on-surface">Catálogo de etiquetas</h2>
          <p className="mt-0.5 text-sm text-on-surface-variant">
            Etiquetas compartidas por todo el producto: proyectos y tareas eligen las suyas de aquí.
          </p>
        </div>
        <Button onClick={() => setShowCreate((v) => !v)} className="h-10">
          <Plus />
          Nueva etiqueta
        </Button>
      </div>

      {showCreate && (
        <CreateLabelForm
          onCreated={(label) => {
            toast.success(`Etiqueta "${label.name}" disponible en el catálogo.`);
            setShowCreate(false);
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      <div className="relative max-w-sm">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-outline" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre…"
          className="h-10 border-outline-variant/50 bg-surface-container-low pl-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-error/20 bg-error-container px-6 py-10 text-center">
          <p className="text-sm font-medium text-on-error-container">
            No se pudo cargar el catálogo de etiquetas
          </p>
          <p className="mt-1 text-xs text-on-error-container/80">
            {error instanceof Error ? error.message : 'Error desconocido'}
          </p>
        </div>
      ) : labels.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant/60 bg-surface-container-low px-6 py-16 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-primary-container text-primary">
            <Tags className="size-7" />
          </div>
          <h3 className="text-lg font-semibold text-on-surface">
            {search.trim() ? 'Sin resultados' : 'Aún no hay etiquetas'}
          </h3>
          <p className="mt-1 max-w-sm text-sm text-on-surface-variant">
            {search.trim()
              ? 'Ninguna etiqueta coincide con la búsqueda.'
              : 'Crea la primera etiqueta del catálogo para que proyectos y tareas la usen.'}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-outline-variant/40 overflow-hidden rounded-xl border border-outline-variant/50 bg-surface-container-low">
          {labels.map((label) => {
            const isToggling = togglingId === label.id;
            return (
              <li
                key={label.id}
                className={cn(
                  'flex flex-wrap items-center gap-3 px-4 py-3',
                  label.archived && 'opacity-70',
                )}
              >
                <LabelChip label={label} size="md" />
                {label.archived ? (
                  <Badge variant="outline" className="text-on-surface-variant">
                    Archivada
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-tertiary/40 text-tertiary"
                  >
                    Activa
                  </Badge>
                )}

                <div className="ml-auto flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleArchived(label)}
                    disabled={isToggling}
                  >
                    {isToggling && <Loader2 className="animate-spin" />}
                    {label.archived ? 'Reactivar' : 'Archivar'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing(label)}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-error hover:bg-error-container hover:text-on-error-container"
                    onClick={() => setDeleting(label)}
                  >
                    Eliminar
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <EditLabelDialog
        label={editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      />
      <DeleteLabelDialog
        label={deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      />
    </div>
  );
}
