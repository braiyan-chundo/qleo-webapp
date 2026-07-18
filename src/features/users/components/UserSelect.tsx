import { useState } from 'react';
import { ChevronsUpDown, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AuthedAvatar } from '@/shared/components/AuthedAvatar';
import { useDebounce } from '@/shared/hooks/use-debounce';
import { cn } from '@/lib/utils';

import { useUserDirectory } from '../hooks/use-users';

/** Forma mínima de un usuario seleccionable. La cumplen `UserDirectoryEntry` y el `User` del store. */
export interface SelectedUser {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  avatarDownloadUrl?: string | null;
}

interface UserSelectProps {
  /** Usuario elegido, o `null` si aún no hay ninguno. */
  value: SelectedUser | null;
  onChange: (user: SelectedUser) => void;
  /** Texto del disparador cuando no hay selección. */
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Selector de un usuario sobre el **directorio** (`GET /users/directory`, §3.2, cualquier
 * autenticado). Muestra el usuario elegido (avatar + nombre) y abre un buscador con debounce para
 * cambiarlo. Lo usan el tab Calendario (ver el de otro usuario) y el editor de Mallas (QL-163).
 * El fetch va por TanStack Query (`useUserDirectory`); nunca directo desde el componente.
 */
export function UserSelect({
  value,
  onChange,
  placeholder = 'Elegir usuario…',
  disabled,
  className,
}: UserSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 300);

  const { data: users, isLoading } = useUserDirectory(debounced, { enabled: open });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <Button
          type="button"
          variant="outline"
          className={cn('h-11 justify-between gap-2 px-3 font-normal', className)}
        >
          {value ? (
            <span className="flex min-w-0 items-center gap-2">
              <AuthedAvatar
                size="sm"
                avatarDownloadUrl={value.avatarDownloadUrl}
                avatarUrl={value.avatarUrl}
                name={value.name}
              />
              <span className="truncate text-on-surface">{value.name}</span>
            </span>
          ) : (
            <span className="text-on-surface-variant">{placeholder}</span>
          )}
          <ChevronsUpDown className="size-4 shrink-0 text-on-surface-variant" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        {/* `shouldFilter={false}`: el filtrado lo hace el backend por `search`. */}
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder="Buscar por nombre o email…"
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
                  Sin usuarios disponibles
                </CommandEmpty>
                <CommandGroup>
                  {(users ?? []).map((user) => (
                    <CommandItem
                      key={user.id}
                      value={user.id}
                      onSelect={() => {
                        onChange(user);
                        setSearch('');
                        setOpen(false);
                      }}
                      className="gap-2"
                    >
                      <AuthedAvatar
                        size="sm"
                        avatarDownloadUrl={user.avatarDownloadUrl}
                        avatarUrl={user.avatarUrl}
                        name={user.name}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-on-surface">{user.name}</p>
                        <p className="truncate text-xs text-on-surface-variant">{user.email}</p>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
