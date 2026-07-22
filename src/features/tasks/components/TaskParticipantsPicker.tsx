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
  /**
   * `CREATOR` de la tarea: **intocable**, así que no es elegible para ningún otro rol (el
   * backend ignoraría su id en silencio). Al crear es el usuario del token; en la edición
   * completa (QL-178) es el creador real de la tarea, que puede no ser quien edita.
   */
  creatorUserId: string | undefined;
  /**
   * (QL-178) Texto de ayuda bajo el selector de Responsable. Por defecto el del alta ("Tú serás
   * el Creador"); en la edición completa el Creador ya existe y no tiene por qué ser el actor.
   */
  assigneeHint?: string;
  /** Id del Responsable elegido; `''` = sin responsable. */
  assigneeId: string;
  /** Ids de los Colaboradores elegidos. */
  collaboratorIds: string[];
  /** (QL-138) Ids de los Observadores elegidos. */
  observerIds: string[];
  onAssigneeChange: (userId: string) => void;
  onCollaboratorsChange: (userIds: string[]) => void;
  /** (QL-138) Cambia la selección de Observadores. */
  onObserversChange: (userIds: string[]) => void;
  disabled?: boolean;
}

interface MemberCheckListProps {
  /** Prefijo de los `id`/`htmlFor` de cada fila (debe ser único por lista). */
  idPrefix: string;
  candidates: ProjectMember[];
  selected: Set<string>;
  onToggle: (userId: string, checked: boolean) => void;
  disabled?: boolean;
}

/**
 * Lista de miembros con casilla. Colaboradores y Observadores se eligen **igual** (misma
 * mecánica, distinto rol), así que comparten esta lista en vez de duplicar el marcado: lo que
 * cambia entre ambos es qué candidatos recibe cada uno, y eso lo decide la precedencia.
 */
function MemberCheckList({
  idPrefix,
  candidates,
  selected,
  onToggle,
  disabled,
}: MemberCheckListProps) {
  return (
    <div className="max-h-44 overflow-y-auto rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-1">
      <ul>
        {candidates.map((member) => (
          <li key={member.id}>
            <label
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-container-high/60"
              htmlFor={`${idPrefix}-${member.id}`}
            >
              <Checkbox
                id={`${idPrefix}-${member.id}`}
                checked={selected.has(member.id)}
                disabled={disabled}
                onCheckedChange={(value) => onToggle(member.id, value === true)}
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
        ))}
      </ul>
    </div>
  );
}

/**
 * (QL-123/QL-138) Elección de **Responsable** (`ASSIGNEE`, único — RF-1.2), **Colaboradores**
 * (`COLLABORATOR`) y **Observadores** (`OBSERVER`, solo lectura) en el **alta** de una tarea.
 * Los tres son opcionales: sin ellos la tarea nace solo con su `CREATOR`, como siempre.
 *
 * (QL-178) Se reutiliza tal cual en la **edición completa** de un ADMIN: mismo control, mismas
 * reglas; solo cambia de dónde salen los valores iniciales (los `assignments` de la tarea) y
 * quién es el `CREATOR` intocable.
 *
 * Los candidatos son la **membresía del proyecto** (misma regla que el `RoleManager`: solo se
 * asigna a miembros, no al directorio global). El `CREATOR` no aparece: su rol es intocable y
 * el backend descarta en silencio su id en cualquiera de los tres campos.
 *
 * **Precedencia `ASSIGNEE` > `COLLABORATOR` > `OBSERVER`**: un usuario tiene un solo rol por
 * tarea, así que cada lista retira a quien ya ocupa un rol superior (el Responsable no aparece
 * como Colaborador; ni el Responsable ni los Colaboradores aparecen como Observadores). La UI
 * **refleja** la regla en vez de delegarla al dedupe silencioso del backend, que dejaría al
 * usuario creyendo que marcó algo que no se va a aplicar.
 */
export function TaskParticipantsPicker({
  members,
  isLoading,
  creatorUserId,
  assigneeHint = 'Solo puede haber un Responsable por tarea. Tú serás el Creador.',
  assigneeId,
  collaboratorIds,
  observerIds,
  onAssigneeChange,
  onCollaboratorsChange,
  onObserversChange,
  disabled,
}: TaskParticipantsPickerProps) {
  // El creador de la tarea nunca es un candidato: su rol `CREATOR` es intocable.
  const candidates = useMemo(
    () => (members ?? []).filter((m) => m.id !== creatorUserId),
    [members, creatorUserId],
  );

  const selectedCollaborators = useMemo(
    () => new Set(collaboratorIds),
    [collaboratorIds],
  );
  const selectedObservers = useMemo(() => new Set(observerIds), [observerIds]);

  // Un usuario no puede ser Responsable y Colaborador a la vez.
  const collaboratorCandidates = useMemo(
    () => candidates.filter((m) => m.id !== assigneeId),
    [candidates, assigneeId],
  );

  // (QL-138) Observador es el rol más bajo: quedan fuera Responsable y Colaboradores.
  const observerCandidates = useMemo(
    () =>
      candidates.filter(
        (m) => m.id !== assigneeId && !selectedCollaborators.has(m.id),
      ),
    [candidates, assigneeId, selectedCollaborators],
  );

  const noCandidates = !isLoading && candidates.length === 0;

  /**
   * Al elegir Responsable se retira del resto de roles: `ASSIGNEE` gana a todo. Hace falta
   * aunque las listas ya lo filtren, porque el usuario pudo marcarlo ANTES como colaborador u
   * observador y elegirlo como Responsable después.
   */
  const handleAssigneeChange = (userId: string) => {
    onAssigneeChange(userId);
    if (!userId) return;
    if (selectedCollaborators.has(userId)) {
      onCollaboratorsChange(collaboratorIds.filter((id) => id !== userId));
    }
    if (selectedObservers.has(userId)) {
      onObserversChange(observerIds.filter((id) => id !== userId));
    }
  };

  /** Marcar a alguien como Colaborador lo retira de Observadores (`COLLABORATOR` > `OBSERVER`). */
  const toggleCollaborator = (userId: string, checked: boolean) => {
    onCollaboratorsChange(
      checked
        ? [...collaboratorIds, userId]
        : collaboratorIds.filter((id) => id !== userId),
    );
    if (checked && selectedObservers.has(userId)) {
      onObserversChange(observerIds.filter((id) => id !== userId));
    }
  };

  const toggleObserver = (userId: string, checked: boolean) => {
    onObserversChange(
      checked
        ? [...observerIds, userId]
        : observerIds.filter((id) => id !== userId),
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
        <span className="text-xs text-on-surface-variant">{assigneeHint}</span>
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
          <MemberCheckList
            idPrefix="collaborator"
            candidates={collaboratorCandidates}
            selected={selectedCollaborators}
            onToggle={toggleCollaborator}
            disabled={disabled}
          />
        )}
      </div>

      {/* (QL-138) Observadores: mismo patrón que Colaboradores, un rol por debajo. */}
      <div className="grid gap-1.5">
        <Label className="text-on-surface">Observadores</Label>

        {noCandidates ? (
          <p className="text-xs text-on-surface-variant">
            Añade más miembros al proyecto para poder asignarlos.
          </p>
        ) : observerCandidates.length === 0 ? (
          <p className="text-xs text-on-surface-variant">
            No quedan miembros disponibles como observadores.
          </p>
        ) : (
          <MemberCheckList
            idPrefix="observer"
            candidates={observerCandidates}
            selected={selectedObservers}
            onToggle={toggleObserver}
            disabled={disabled}
          />
        )}
        <span className="text-xs text-on-surface-variant">
          Los Observadores son solo lectura: pueden ver la tarea, pero no moverla, ni
          comentarla, ni completarla.
        </span>
      </div>
    </div>
  );
}
