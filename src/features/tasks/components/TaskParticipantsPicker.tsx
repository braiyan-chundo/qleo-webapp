import { useMemo } from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { AuthedAvatar } from '@/shared/components/AuthedAvatar';
import type { ProjectMember } from '@/features/projects/types/project';

interface TaskParticipantsPickerProps {
  /** Membresía real del proyecto (`GET /projects/:id/members`, §3.20). */
  members: ProjectMember[] | undefined;
  isLoading: boolean;
  /** Usuario del token: será el `CREATOR`, así que no es elegible (el backend lo ignoraría). */
  currentUserId: string | undefined;
  /** Id del Responsable elegido; `''` = sin responsable. */
  assigneeId: string;
  /** Ids de los Colaboradores elegidos. */
  collaboratorIds: string[];
  onAssigneeChange: (userId: string) => void;
  onCollaboratorsChange: (userIds: string[]) => void;
  disabled?: boolean;
}

/**
 * (QL-123) Elección de **Responsable** (`ASSIGNEE`, único — RF-1.2) y **Colaboradores**
 * (`COLLABORATOR`) en el **alta** de una tarea. Ambos son opcionales: sin ellos la tarea nace
 * solo con su `CREATOR`, como siempre.
 *
 * Los candidatos son la **membresía del proyecto** (misma regla que el `RoleManager`: solo se
 * asigna a miembros, no al directorio global). El usuario actual no aparece: al crear ya queda
 * como `CREATOR` y el backend descarta en silencio su id en `assigneeId`/`collaboratorIds`.
 * El Responsable elegido se retira de la lista de Colaboradores para que la UI **refleje** la
 * regla de un solo rol por usuario, en vez de delegarla al dedupe del backend.
 */
export function TaskParticipantsPicker({
  members,
  isLoading,
  currentUserId,
  assigneeId,
  collaboratorIds,
  onAssigneeChange,
  onCollaboratorsChange,
  disabled,
}: TaskParticipantsPickerProps) {
  // El creador de la tarea (usuario del token) nunca es un candidato.
  const candidates = useMemo(
    () => (members ?? []).filter((m) => m.id !== currentUserId),
    [members, currentUserId],
  );

  // Un usuario no puede ser Responsable y Colaborador a la vez.
  const collaboratorCandidates = useMemo(
    () => candidates.filter((m) => m.id !== assigneeId),
    [candidates, assigneeId],
  );

  const selected = useMemo(() => new Set(collaboratorIds), [collaboratorIds]);
  const noCandidates = !isLoading && candidates.length === 0;

  /** Al elegir Responsable, se retira de Colaboradores (no puede tener los dos roles). */
  const handleAssigneeChange = (userId: string) => {
    onAssigneeChange(userId);
    if (userId && selected.has(userId)) {
      onCollaboratorsChange(collaboratorIds.filter((id) => id !== userId));
    }
  };

  const toggleCollaborator = (userId: string, checked: boolean) => {
    onCollaboratorsChange(
      checked
        ? [...collaboratorIds, userId]
        : collaboratorIds.filter((id) => id !== userId),
    );
  };

  return (
    <div className="grid gap-4 border-t border-outline-variant/40 pt-4">
      <div className="grid gap-1.5">
        <Label htmlFor="assigneeId" className="text-on-surface">
          Responsable
        </Label>
        <NativeSelect
          id="assigneeId"
          className="w-full [&>select]:h-10"
          disabled={disabled || isLoading || noCandidates}
          value={assigneeId}
          onChange={(e) => handleAssigneeChange(e.target.value)}
        >
          <NativeSelectOption value="">
            {isLoading
              ? 'Cargando miembros…'
              : noCandidates
                ? 'Sin otros miembros en el proyecto'
                : 'Sin responsable'}
          </NativeSelectOption>
          {candidates.map((member) => (
            <NativeSelectOption key={member.id} value={member.id}>
              {member.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <span className="text-xs text-on-surface-variant">
          Solo puede haber un Responsable por tarea. Tú serás el Creador.
        </span>
      </div>

      <div className="grid gap-1.5">
        <Label className="text-on-surface">Colaboradores</Label>

        {noCandidates ? (
          <p className="text-xs text-on-surface-variant">
            Añade más miembros al proyecto para poder asignarlos.
          </p>
        ) : collaboratorCandidates.length === 0 ? (
          <p className="text-xs text-on-surface-variant">
            No quedan miembros disponibles como colaboradores.
          </p>
        ) : (
          <div className="max-h-44 overflow-y-auto rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-1">
            <ul>
              {collaboratorCandidates.map((member) => {
                const checked = selected.has(member.id);
                return (
                  <li key={member.id}>
                    <label
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-container-high/60"
                      htmlFor={`collaborator-${member.id}`}
                    >
                      <Checkbox
                        id={`collaborator-${member.id}`}
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={(value) =>
                          toggleCollaborator(member.id, value === true)
                        }
                      />
                      <AuthedAvatar
                        size="sm"
                        avatarDownloadUrl={member.avatarDownloadUrl}
                        name={member.name}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm text-on-surface">
                        {member.name}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
