import { useMemo, useState } from 'react';
import { Loader2, Plus, Tags, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/shared/hooks/use-debounce';
import { labelPill } from '@/features/tasks/lib/palette';

import { useLabels } from '../hooks/use-labels';
import type { Label } from '../services/labels.service';
import { resolveLabelIcon } from '../lib/label-icons';
import { LabelChip } from './LabelChip';
import { CreateLabelForm } from './CreateLabelForm';

interface ProjectLabelManagerProps {
  /** Etiquetas adoptadas por el proyecto (objetos completos para pintar chips). */
  value: Label[];
  onChange: (labels: Label[]) => void;
}

/**
 * Gestión de las etiquetas de un proyecto (QL-146, §3.38). Permite: (a) **elegir** del catálogo
 * global (popover buscable), (b) **crear** una nueva (nombre + icono + color, get-or-create) que
 * se suma a la selección, y (c) **quitar** de la selección. El contenedor (`ProjectFormDialog`)
 * envía `labelIds = value.map(l => l.id)` al guardar; aquí no se persiste nada por sí solo.
 */
export function ProjectLabelManager({ value, onChange }: ProjectLabelManagerProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 300);

  const { data: catalog, isLoading } = useLabels(debounced, {
    enabled: pickerOpen,
  });

  const selectedIds = useMemo(
    () => new Set(value.map((label) => label.id)),
    [value],
  );

  const candidates = (catalog ?? []).filter(
    (label) => !selectedIds.has(label.id),
  );

  const addLabel = (label: Label) => {
    if (selectedIds.has(label.id)) return;
    onChange([...value, label]);
  };

  const removeLabel = (id: string) => {
    onChange(value.filter((label) => label.id !== id));
  };

  const handleCreated = (label: Label) => {
    addLabel(label);
    setCreating(false);
  };

  return (
    <div className="space-y-2">
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((label) => (
            <span key={label.id} className="inline-flex items-center">
              <LabelChip label={label} />
              <button
                type="button"
                onClick={() => removeLabel(label.id)}
                aria-label={`Quitar ${label.name}`}
                className="-ml-0.5 flex size-4 items-center justify-center rounded-full text-on-surface-variant hover:text-error"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-on-surface-variant">
          Este proyecto todavía no usa etiquetas. Elígelas del catálogo o crea una nueva.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <Tags />
              Elegir del catálogo
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-0">
            {/* `shouldFilter={false}`: el filtrado lo hace el backend por `search`. */}
            <Command shouldFilter={false}>
              <CommandInput
                value={search}
                onValueChange={setSearch}
                placeholder="Buscar etiqueta…"
              />
              <CommandList>
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2 py-6 text-sm text-on-surface-variant">
                    <Loader2 className="size-4 animate-spin" />
                    Buscando…
                  </div>
                ) : (
                  <>
                    <CommandEmpty className="text-on-surface-variant">
                      Sin etiquetas disponibles
                    </CommandEmpty>
                    <CommandGroup>
                      {candidates.map((label) => {
                        const Icon = resolveLabelIcon(label.icon);
                        return (
                          <CommandItem
                            key={label.id}
                            value={label.id}
                            onSelect={() => {
                              addLabel(label);
                              setSearch('');
                            }}
                            className="gap-2"
                          >
                            <span
                              className={cn(
                                'flex size-6 shrink-0 items-center justify-center rounded',
                                labelPill(label.color ?? 'gray', 0),
                              )}
                            >
                              <Icon className="size-3.5" />
                            </span>
                            <span className="truncate text-sm text-on-surface">
                              {label.name}
                            </span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {!creating && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCreating(true)}
          >
            <Plus />
            Crear etiqueta
          </Button>
        )}
      </div>

      {creating && (
        <CreateLabelForm
          onCreated={handleCreated}
          onCancel={() => setCreating(false)}
        />
      )}
    </div>
  );
}
