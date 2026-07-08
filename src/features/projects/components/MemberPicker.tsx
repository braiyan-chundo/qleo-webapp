import { useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

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
import { AuthedAvatar } from '@/shared/components/AuthedAvatar';
import { useDebounce } from '@/shared/hooks/use-debounce';
import { useUserDirectory } from '@/features/users/hooks/use-users';
import type { UserDirectoryEntry } from '@/features/users/services/users.service';

interface MemberPickerProps {
  /** Disparador del popover (un `Button`, normalmente). */
  trigger: ReactNode;
  /** Ids ya seleccionados/miembros: se filtran de los resultados. */
  excludeIds: Set<string>;
  /** Se invoca al elegir un usuario del directorio. */
  onSelect: (user: UserDirectoryEntry) => void;
  disabled?: boolean;
}

/**
 * Popover buscable sobre el **directorio de usuarios** (`GET /users/directory`, §3.2) con
 * debounce. Reutilizable para el multi-select de creación y el panel de gestión de miembros.
 * El fetch va por TanStack Query (`useUserDirectory`); nunca directo desde el componente.
 */
export function MemberPicker({
  trigger,
  excludeIds,
  onSelect,
  disabled,
}: MemberPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 300);

  const { data: users, isLoading } = useUserDirectory(debounced, {
    enabled: open,
  });

  const candidates = (users ?? []).filter((u) => !excludeIds.has(u.id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        {trigger}
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
                  {candidates.map((user) => (
                    <CommandItem
                      key={user.id}
                      value={user.id}
                      onSelect={() => {
                        onSelect(user);
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
                        <p className="truncate text-sm font-medium text-on-surface">
                          {user.name}
                        </p>
                        <p className="truncate text-xs text-on-surface-variant">
                          {user.email}
                        </p>
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
