import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label as FieldLabel } from '@/components/ui/label';

import { useCreateLabel } from '../hooks/use-labels';
import type { Label, LabelColor } from '../services/labels.service';
import { LabelChip } from './LabelChip';
import { LabelColorPicker } from './LabelColorPicker';
import { LabelIconPicker } from './LabelIconPicker';

interface CreateLabelFormProps {
  /** Recibe la etiqueta creada (o la existente, por el get-or-create del backend). */
  onCreated: (label: Label) => void;
  onCancel: () => void;
}

const MAX_NAME = 40;

/**
 * Formulario **inline** para crear una etiqueta nueva (nombre + icono + color) desde la
 * gestión de etiquetas del proyecto (QL-146, §3.38). No usa `<form>` propio: vive dentro del
 * formulario del proyecto, así que un `<form>` anidado sería HTML inválido. El backend hace
 * **get-or-create**, así que "crear" una que ya existe devuelve la existente sin duplicar.
 */
export function CreateLabelForm({ onCreated, onCancel }: CreateLabelFormProps) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('tag');
  const [color, setColor] = useState<LabelColor>('gray');
  const createLabel = useCreateLabel();

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && !createLabel.isPending;

  const handleCreate = () => {
    if (!canSubmit) return;
    createLabel.mutate(
      { name: trimmed, icon, color },
      {
        onSuccess: (label) => {
          onCreated(label);
          setName('');
          setIcon('tag');
          setColor('gray');
        },
        onError: (err) => {
          toast.error(
            err instanceof Error ? err.message : 'No se pudo crear la etiqueta',
          );
        },
      },
    );
  };

  return (
    <div className="grid gap-3 rounded-lg border border-outline-variant/60 bg-surface-container-low p-3">
      <div className="grid gap-1.5">
        <FieldLabel htmlFor="new-label-name" className="text-on-surface">
          Nombre de la etiqueta
        </FieldLabel>
        <Input
          id="new-label-name"
          value={name}
          maxLength={MAX_NAME}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleCreate();
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

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-on-surface-variant">Vista previa:</span>
        <LabelChip
          label={{
            id: 'preview',
            name: trimmed || 'Etiqueta',
            icon,
            color,
            archived: false,
            createdAt: '',
          }}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleCreate}
          disabled={!canSubmit}
        >
          {createLabel.isPending && <Loader2 className="animate-spin" />}
          Añadir etiqueta
        </Button>
      </div>
    </div>
  );
}
