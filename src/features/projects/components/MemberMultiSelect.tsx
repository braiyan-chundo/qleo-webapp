import { useMemo } from 'react';
import { UserPlus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { AuthedAvatar } from '@/shared/components/AuthedAvatar';
import type { UserDirectoryEntry } from '@/features/users/services/users.service';

import { MemberPicker } from './MemberPicker';

/** El creador se fija como miembro (auto-agregado por el backend, §3.20). */
export interface FixedCreator {
  id: string;
  name: string;
  avatarDownloadUrl?: string | null;
  avatarUrl?: string | null;
}

interface MemberMultiSelectProps {
  /** Miembros elegidos además del creador (objetos completos para pintar chips). */
  value: UserDirectoryEntry[];
  onChange: (members: UserDirectoryEntry[]) => void;
  /** Creador del proyecto: siempre miembro, no quitable. */
  creator: FixedCreator;
}

/**
 * Multi-select de miembros para la **creación** de un proyecto (QL-52). El creador aparece
 * fijado (chip sin botón de quitar); el resto se elige del directorio (`MemberPicker`) y se
 * puede retirar. La lista se resuelve al crear el proyecto vía `POST /projects/:id/members`.
 */
export function MemberMultiSelect({
  value,
  onChange,
  creator,
}: MemberMultiSelectProps) {
  // El creador y los ya elegidos no deben reaparecer en el directorio.
  const excludeIds = useMemo(
    () => new Set<string>([creator.id, ...value.map((u) => u.id)]),
    [creator.id, value],
  );

  const addMember = (user: UserDirectoryEntry) => {
    if (excludeIds.has(user.id)) return;
    onChange([...value, user]);
  };

  const removeMember = (id: string) => {
    onChange(value.filter((u) => u.id !== id));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {/* Creador fijo */}
        <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary-container py-1 pr-2.5 pl-1 text-xs font-medium text-on-secondary-container">
          <AuthedAvatar
            size="sm"
            avatarDownloadUrl={creator.avatarDownloadUrl}
            avatarUrl={creator.avatarUrl}
            name={creator.name}
          />
          {creator.name}
          <span className="text-on-secondary-container/70">(tú)</span>
        </span>

        {value.map((member) => (
          <span
            key={member.id}
            className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-high py-1 pr-1 pl-1 text-xs font-medium text-on-surface"
          >
            <AuthedAvatar
              size="sm"
              avatarDownloadUrl={member.avatarDownloadUrl}
              avatarUrl={member.avatarUrl}
              name={member.name}
            />
            {member.name}
            <button
              type="button"
              onClick={() => removeMember(member.id)}
              aria-label={`Quitar a ${member.name}`}
              className="flex size-4 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-highest hover:text-error"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
      </div>

      <MemberPicker
        excludeIds={excludeIds}
        onSelect={addMember}
        trigger={
          <Button type="button" variant="outline" size="sm">
            <UserPlus />
            Añadir miembro
          </Button>
        }
      />
    </div>
  );
}
