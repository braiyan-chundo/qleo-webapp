import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { AuthedAvatar } from '@/shared/components/AuthedAvatar';
import type { ProjectMember } from '@/features/projects/types/project';
import type { AbsentUser } from '@/features/absences/services/absences.service';
import { absenceNotice, absenceOptionSuffix } from '@/features/absences/lib/absence';

interface TaskParticipantsPickerProps {
  /** Membresía real del proyecto (`GET /projects/:id/members`, §3.20). */
  members: ProjectMember[] | undefined;
  isLoading: boolean;
  /**
   * `CREATOR` de la tarea. Su rol es **intocable**, así que no es elegible como Colaborador ni
   * como Observador (el backend ignoraría su id en silencio). (QL-192) Sí es elegible como
   * **Responsable**: el Creador puede asumir su propia tarea. Al crear es el usuario del token;
   * en la edición completa (QL-178) es el creador real, que puede no ser quien edita.
   */
  creatorUserId: string | undefined;
  /**
   * (QL-178) Texto de ayuda bajo el selector de Responsable. Por defecto el del alta ("Tú serás
   * el Creador"); en la edición completa el Creador ya existe y no tiene por qué ser el actor.
   */
  assigneeHint?: string;
  /**
   * Id del Responsable elegido. (QL-192) `''` solo aparece como estado transitorio (miembros aún
   * sin cargar, o una tarea antigua que nació sin Responsable): **no es un valor elegible**.
   */
  assigneeId: string;
  /**
   * (QL-192) Nombre del Responsable actual, para conservarlo como opción si ya no figura en la
   * membresía del proyecto (tarea antigua, o alguien a quien sacaron del proyecto).
   */
  assigneeFallbackName?: string;
  /** Ids de los Colaboradores elegidos. */
  collaboratorIds: string[];
  /** (QL-138) Ids de los Observadores elegidos. */
  observerIds: string[];
  onAssigneeChange: (userId: string) => void;
  onCollaboratorsChange: (userIds: string[]) => void;
  /** (QL-138) Cambia la selección de Observadores. */
  onObserversChange: (userIds: string[]) => void;
  disabled?: boolean;
  /**
   * (QL-199, §3.71 §2) Personas ausentes en el periodo de la tarea, indexadas por `userId`
   * (`GET /absences/who-is-out`). Se **marca**, nunca se bloquea: una asignación a alguien que
   * está fuera puede ser perfectamente legítima (una tarea que arranca cuando ya volvió), y una
   * ausencia mal cargada no puede dejar a nadie sin poder recibir trabajo.
   *
   * Vacío o ausente = nadie está fuera, o el dato aún no ha llegado.
   */
  absentByUser?: Map<string, AbsentUser>;
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
 * asigna a miembros, no al directorio global). El `CREATOR` no aparece como Colaborador ni como
 * Observador: ese rol suyo es intocable y el backend descarta en silencio su id ahí.
 *
 * (QL-192) El `CREATOR` **sí** aparece en el selector de Responsable —puede asumir su propia
 * tarea— y ese selector **no ofrece "sin responsable"**: toda tarea tiene Responsable, así que
 * dejar de serlo pasa por nombrar a otra persona, nunca por vaciar el campo.
 *
 * **Precedencia `ASSIGNEE` > `COLLABORATOR` > `OBSERVER`** para el resto: cada lista retira a
 * quien ya ocupa un rol superior (el Responsable no aparece como Colaborador; ni el Responsable
 * ni los Colaboradores aparecen como Observadores). La UI **refleja** la regla en vez de
 * delegarla al dedupe silencioso del backend, que dejaría al usuario creyendo que marcó algo
 * que no se va a aplicar.
 */
export function TaskParticipantsPicker({
  members,
  isLoading,
  creatorUserId,
  assigneeHint = 'Toda tarea tiene un único Responsable. Viene preseleccionado contigo (serás el Creador); elige a otra persona si no vas a serlo tú.',
  assigneeId,
  assigneeFallbackName,
  collaboratorIds,
  observerIds,
  onAssigneeChange,
  onCollaboratorsChange,
  onObserversChange,
  disabled,
  absentByUser,
}: TaskParticipantsPickerProps) {
  /**
   * (QL-192) Candidatos a **Responsable**: todos los miembros, incluido el Creador. Si el
   * Responsable actual ya no figura en la membresía (edición de una tarea antigua), se conserva
   * como opción para no perder el valor seleccionado al abrir el formulario.
   */
  const assigneeCandidates = useMemo(() => {
    const list = members ?? [];
    if (!assigneeId || list.some((m) => m.id === assigneeId)) return list;
    return [
      ...list,
      {
        id: assigneeId,
        name: assigneeFallbackName ?? 'Responsable actual',
        avatarDownloadUrl: null,
      },
    ];
  }, [members, assigneeId, assigneeFallbackName]);

  // El creador de la tarea nunca es candidato a Colaborador/Observador: su rol es intocable.
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
  const noAssigneeCandidates = !isLoading && assigneeCandidates.length === 0;

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

  /**
   * (QL-199) Aviso de ausencia del Responsable elegido. **No modal y no bloqueante**: el
   * formulario se puede guardar con él en pantalla — es la decisión de producto que manda sobre
   * todo lo demás (§3.71 §0), y el backend no valida nada de esto, así que si no se pinta aquí no
   * avisa nadie.
   */
  const assigneeAbsence = assigneeId ? absentByUser?.get(assigneeId) : undefined;
  const assigneeRef = useRef<HTMLSelectElement>(null);
  /** "Asignar de todas formas" descarta el aviso para ESA persona, no para siempre. */
  const [acknowledgedAbsence, setAcknowledgedAbsence] = useState<string | null>(null);

  // Cambiar de Responsable (o de fechas, que cambia el aviso) vuelve a mostrarlo: lo aceptado fue
  // una asignación concreta, no la idea de ignorar ausencias.
  useEffect(() => {
    setAcknowledgedAbsence(null);
  }, [assigneeId, assigneeAbsence?.returnsOn]);

  const showAbsenceWarning =
    !!assigneeAbsence && acknowledgedAbsence !== assigneeAbsence.userId;

  return (
    <div className="grid gap-4 border-t border-outline-variant/40 pt-4">
      <div className="grid gap-1.5">
        <Label htmlFor="assigneeId" className="text-on-surface">
          Responsable
        </Label>
        <NativeSelect
          id="assigneeId"
          ref={assigneeRef}
          className="w-full [&>select]:h-10"
          disabled={disabled || isLoading || noAssigneeCandidates}
          value={assigneeId}
          onChange={(e) => handleAssigneeChange(e.target.value)}
        >
          {/* (QL-192) "Sin responsable" ya no es un estado posible: el hueco vacío solo existe
              mientras cargan los miembros (o en una tarea antigua sin Responsable) y está
              deshabilitado para que no se pueda volver a él. */}
          {!assigneeId && (
            <NativeSelectOption value="" disabled>
              {isLoading
                ? 'Cargando miembros…'
                : noAssigneeCandidates
                  ? 'Sin miembros en el proyecto'
                  : 'Selecciona un Responsable'}
            </NativeSelectOption>
          )}
          {assigneeCandidates.map((member) => {
            // (QL-199) La marca va EN la opción, no deshabilitándola: se ve al elegir, y quien
            // quiera asignar a esa persona puede hacerlo igual.
            const absence = absentByUser?.get(member.id);
            return (
              <NativeSelectOption key={member.id} value={member.id}>
                {absence ? `${member.name} — ${absenceOptionSuffix(absence)}` : member.name}
              </NativeSelectOption>
            );
          })}
        </NativeSelect>
        <span className="text-xs text-on-surface-variant">{assigneeHint}</span>

        {/* (QL-199, §3.71 §2) Aviso NO bloqueante. El copy sale entero de la API: `typeLabel` (ya
            enmascarado si el tipo era reservado) y `returnsOn` (ya encadenado con las ausencias
            consecutivas). El botón primario es continuar. */}
        {showAbsenceWarning && assigneeAbsence && (
          <div className="mt-1 grid gap-2 rounded-lg border border-warning/30 bg-warning-container/40 px-3 py-2.5">
            <p className="inline-flex items-start gap-1.5 text-xs text-on-warning-container">
              <CalendarOff className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>{absenceNotice(assigneeAbsence)}</span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => setAcknowledgedAbsence(assigneeAbsence.userId)}
              >
                Asignar de todas formas
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => assigneeRef.current?.focus()}
              >
                Elegir a otra persona
              </Button>
            </div>
          </div>
        )}
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
        {/* (QL-196) Los Observadores YA comentan: el texto decía lo contrario y era la fuente
            de la confusión de "solo lectura". Supervisan, no ejecutan. */}
        <span className="text-xs text-on-surface-variant">
          Los Observadores supervisan: ven la tarea, comentan en su hilo y validan su cierre,
          pero no la mueven, ni la editan, ni la completan.
        </span>
      </div>
    </div>
  );
}
