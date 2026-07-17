import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label as FieldLabel } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

import { useUpdateLabel } from '../hooks/use-labels';
import type { Label, LabelColor } from '../services/labels.service';
import { LabelChip } from './LabelChip';
import { LabelColorPicker } from './LabelColorPicker';
import { LabelIconPicker } from './LabelIconPicker';

interface EditLabelDialogProps {
  /** Etiqueta en edición; `null` mantiene el diálogo cerrado. */
  label: Label | null;
  onOpenChange: (open: boolean) => void;
}

const MAX_NAME = 40;

/**
 * Edición de una etiqueta del catálogo global (QL-149, §3.38, **solo ADMIN**). Cubre nombre,
 * icono, color y el estado **archivada** (una etiqueta archivada desaparece del picker sin romper
 * referencias). Reusa los mismos pickers que el alta para un lenguaje visual único.
 *
 * Solo envía los campos que cambiaron (parche parcial). El renombre puede chocar con otra etiqueta
 * → **409 `LABEL_NAME_TAKEN`**, que se traduce a un mensaje claro.
 */
export function EditLabelDialog({ label, onOpenChange }: EditLabelDialogProps) {
  const updateLabel = useUpdateLabel();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('tag');
  const [color, setColor] = useState<LabelColor>('gray');
  const [archived, setArchived] = useState(false);

  // Rehidratar el formulario cada vez que se abre con otra etiqueta.
  useEffect(() => {
    if (!label) return;
    setName(label.name);
    setIcon(label.icon);
    setColor(label.color ?? 'gray');
    setArchived(label.archived);
  }, [label]);

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && !updateLabel.isPending;

  const handleSave = () => {
    if (!label || !canSubmit) return;

    // Parche parcial: solo lo que cambió respecto al valor original.
    const data: Parameters<typeof updateLabel.mutate>[0]['data'] = {};
    if (trimmed !== label.name) data.name = trimmed;
    if (icon !== label.icon) data.icon = icon;
    if (color !== (label.color ?? 'gray')) data.color = color;
    if (archived !== label.archived) data.archived = archived;

    if (Object.keys(data).length === 0) {
      onOpenChange(false);
      return;
    }

    updateLabel.mutate(
      { id: label.id, data },
      {
        onSuccess: () => {
          toast.success('Etiqueta actualizada.');
          onOpenChange(false);
        },
        onError: (err) => {
          const message =
            err instanceof Error
              ? err.message
              : 'No se pudo actualizar la etiqueta.';
          toast.error(message);
        },
      },
    );
  };

  return (
    <Dialog open={!!label} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar etiqueta</DialogTitle>
          <DialogDescription>
            Cambios del catálogo global: se reflejan en todos los proyectos y tareas que la usan.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-1">
          <div className="grid gap-1.5">
            <FieldLabel htmlFor="edit-label-name" className="text-on-surface">
              Nombre de la etiqueta
            </FieldLabel>
            <Input
              id="edit-label-name"
              value={name}
              maxLength={MAX_NAME}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSave();
                }
              }}
              placeholder="Hotel"
              className="h-10"
            />
          </div>

          <div className="grid gap-1.5">
            <span className="text-sm font-medium text-on-surface">Icono</span>
            <LabelIconPicker value={icon} onChange={setIcon} />
          </div>

          <div className="grid gap-1.5">
            <span className="text-sm font-medium text-on-surface">Color</span>
            <LabelColorPicker value={color} onChange={setColor} />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant/60 bg-surface-container-low p-3">
            <div className="grid gap-0.5">
              <FieldLabel htmlFor="edit-label-archived" className="text-on-surface">
                Archivada
              </FieldLabel>
              <span className="text-xs text-on-surface-variant">
                Se oculta del selector sin borrar sus referencias.
              </span>
            </div>
            <Switch
              id="edit-label-archived"
              checked={archived}
              onCheckedChange={setArchived}
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-on-surface-variant">Vista previa:</span>
            <LabelChip
              label={{
                id: label?.id ?? 'preview',
                name: trimmed || 'Etiqueta',
                icon,
                color,
                archived,
                createdAt: '',
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateLabel.isPending}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={!canSubmit}>
            {updateLabel.isPending && <Loader2 className="animate-spin" />}
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
