import { useState } from 'react';
import { Ban, Check, ChevronDown, ClipboardList, Info, Loader2, Lock, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useDebounce } from '@/shared/hooks/use-debounce';
import { cn } from '@/lib/utils';

import { useReminderTaskOptions } from '../hooks/use-reminders';
import { StatePill } from './ReminderStatePill';

/** Tarea elegida en el formulario. `title: null` = asociada pero **sin acceso** (no se revela). */
export interface PickedTask {
  id: string;
  title: string | null;
  projectName?: string;
  completed?: boolean;
}

interface ReminderTaskPickerProps {
  id?: string;
  value: PickedTask | null;
  onChange: (task: PickedTask | null) => void;
  /** Desde la vista de tarea: la tarea va fija y no se ofrece el selector (AC-18). */
  fixed?: boolean;
  invalid?: boolean;
  disabled?: boolean;
}

/** Resalta la búsqueda (literal, sin distinguir mayúsculas) dentro del título. */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  const index = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (index < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark className="bg-transparent font-semibold text-primary">
        {text.slice(index, index + q.length)}
      </mark>
      {text.slice(index + q.length)}
    </>
  );
}

const fieldBase =
  'flex h-10 w-full min-w-0 items-center gap-2 rounded-lg border border-input px-3 text-sm max-md:h-11 max-md:text-base';

/**
 * Selector de la tarea de un recordatorio (AC-18, AC-20). Ofrece **solo** lo que devuelve
 * `GET /reminders/task-options` (las tareas que la persona ve), buscable por título, con «Sin
 * tarea» siempre arriba. El filtrado es del servidor: aquí no se decide qué tarea se puede ver.
 */
export function ReminderTaskPicker({
  id,
  value,
  onChange,
  fixed = false,
  invalid = false,
  disabled = false,
}: ReminderTaskPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 300);
  const { data: options, isLoading, isFetching } = useReminderTaskOptions(debounced, {
    enabled: open && !fixed,
  });

  if (fixed) {
    return (
      <div className="grid gap-1.5">
        <div
          id={id}
          className={cn(fieldBase, 'border-transparent bg-surface-container text-on-surface')}
        >
          <ClipboardList className="size-4 shrink-0 text-on-surface-variant" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{value?.title ?? 'Tarea sin acceso'}</span>
          <Lock className="size-3.5 shrink-0 text-on-surface-variant" aria-hidden />
        </div>
        <p className="flex items-start gap-1.5 text-xs text-on-surface-variant">
          <Lock className="mt-0.5 size-3 shrink-0" aria-hidden />
          <span>Asociado a esta tarea; desde aquí no se cambia.</span>
        </p>
      </div>
    );
  }

  const searching = isLoading || (isFetching && debounced !== search);
  const list = options ?? [];
  const query = debounced.trim();

  return (
    <div className="grid gap-1.5">
      <div className="relative">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild disabled={disabled}>
            <Button
              id={id}
              type="button"
              variant="outline"
              aria-invalid={invalid || undefined}
              className={cn(
                'h-10 w-full justify-start gap-2 px-3 font-normal max-md:h-11 max-md:text-base',
                value && 'pr-11',
              )}
            >
              {value?.title === null ? (
                <Lock className="size-4 shrink-0 text-on-surface-variant" aria-hidden />
              ) : (
                <ClipboardList className="size-4 shrink-0 text-on-surface-variant" aria-hidden />
              )}
              {value ? (
                <>
                  <span className="min-w-0 truncate text-on-surface">
                    {value.title ?? 'Tarea sin acceso'}
                  </span>
                  {value.projectName && (
                    <span className="ml-auto hidden shrink-0 truncate text-xs text-on-surface-variant md:inline">
                      {value.projectName}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="text-on-surface-variant">Sin tarea</span>
                  <ChevronDown className="ml-auto size-4 text-on-surface-variant" aria-hidden />
                </>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-72 p-0">
            {/* `shouldFilter={false}`: busca el servidor (`search`), no el cliente. */}
            <Command shouldFilter={false}>
              <CommandInput
                value={search}
                onValueChange={setSearch}
                // La API admite hasta 100 (`search` > 100 → 400): más allá diría «Ninguna tarea…» en falso.
                maxLength={100}
                placeholder="Buscar tarea por título…"
                className="max-md:text-base"
              />
              <CommandList className="max-h-72">
                {searching && list.length === 0 ? (
                  <div className="flex items-center justify-center gap-2 px-3 py-5 text-sm text-on-surface-variant">
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Buscando tus tareas…
                  </div>
                ) : (
                  <>
                    <CommandGroup>
                      <CommandItem
                        value="__none__"
                        onSelect={() => {
                          onChange(null);
                          setOpen(false);
                        }}
                        className="min-h-9 gap-2.5 max-md:min-h-12"
                      >
                        <Ban className="size-4 text-on-surface-variant" aria-hidden />
                        <span className="text-on-surface">Sin tarea</span>
                        {!value && <Check className="ml-auto size-4" aria-hidden />}
                      </CommandItem>
                    </CommandGroup>
                    {list.length > 0 ? (
                      <CommandGroup heading="Tareas que puedes ver">
                        {list.map((task) => (
                          <CommandItem
                            key={task.id}
                            value={task.id}
                            onSelect={() => {
                              onChange({
                                id: task.id,
                                title: task.title,
                                projectName: task.projectName,
                                completed: task.completed,
                              });
                              setSearch('');
                              setOpen(false);
                            }}
                            className="min-h-9 gap-2.5 max-md:min-h-12"
                          >
                            <ClipboardList className="size-4 text-on-surface-variant" aria-hidden />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm text-on-surface">
                                <Highlight text={task.title} query={query} />
                              </p>
                              <p className="truncate text-xs text-on-surface-variant">
                                {task.projectName}
                              </p>
                            </div>
                            {task.completed && <StatePill icon={Check}>Completada</StatePill>}
                            {value?.id === task.id && <Check className="size-4" aria-hidden />}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    ) : (
                      query && (
                        <p className="px-3 py-5 text-center text-sm text-on-surface-variant">
                          Ninguna tarea que puedas ver se llama «{query}».
                        </p>
                      )
                    )}
                  </>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {value && !disabled && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Quitar la tarea"
            onClick={() => onChange(null)}
            className="absolute top-1/2 right-1 -translate-y-1/2 text-on-surface-variant max-md:size-10"
          >
            <X className="size-3.5" />
          </Button>
        )}
      </div>
      {value?.completed && (
        <p className="flex items-start gap-1.5 text-xs text-on-surface-variant">
          <Info className="mt-0.5 size-3 shrink-0" aria-hidden />
          <span>Esta tarea está completada: el recordatorio no sonará mientras siga así.</span>
        </p>
      )}
    </div>
  );
}
