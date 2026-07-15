import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Trash2, UserPlus } from 'lucide-react';

import { ApiError } from '@/core/api/fetch-client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { AuthedAvatar } from '@/shared/components/AuthedAvatar';
import type { UserDirectoryEntry } from '@/features/users/services/users.service';

import {
  useAddManager,
  useAddProjectMember,
  useProjectMembers,
  useRemoveManager,
  useRemoveProjectMember,
} from '../hooks/use-projects';
import type { ProjectMember } from '../types/project';
import { MemberPicker } from './MemberPicker';

interface ProjectMembersPanelProps {
  projectId: string;
  /** Id del creador: siempre miembro, no se puede quitar; gestor implícito (§3.20). */
  createdBy: string;
  /** IDs de miembros con permiso de gestión otorgado (§3.20, P2). */
  managerIds: string[];
  /**
   * Gate cosmético de **membresía y permisos** (`ADMIN || createdBy === user.id`); habilita
   * añadir/quitar miembros y otorgar/revocar managers. El backend igual valida.
   */
  canManage: boolean;
}

/** Traduce un `error.code` de negocio de membresía a un mensaje claro. */
function memberErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'USER_NOT_PROJECT_MEMBER':
        return 'El destinatario debe ser miembro del proyecto.';
      case 'MEMBER_HAS_OPEN_ASSIGNMENTS':
        return 'El miembro tiene tareas abiertas; traspásalas antes de quitarlo.';
    }
  }
  return err instanceof Error ? err.message : 'No se pudo actualizar la membresía';
}

/**
 * Panel de gestión de la **membresía real** del proyecto (QL-52). Lista los miembros
 * (`GET /projects/:id/members`), permite añadir desde el directorio y quitar. Al quitar un
 * miembro con tareas abiertas, el backend responde 409 `MEMBER_HAS_OPEN_ASSIGNMENTS`: se
 * abre un diálogo de **traspaso** para elegir a otro miembro y reintentar con `?reassignTo`.
 * Todas las acciones se ocultan si `canManage` es falso (solo lectura).
 */
export function ProjectMembersPanel({
  projectId,
  createdBy,
  managerIds,
  canManage,
}: ProjectMembersPanelProps) {
  const { data: members, isLoading } = useProjectMembers(projectId);
  const addMember = useAddProjectMember(projectId);
  const removeMember = useRemoveProjectMember(projectId);
  const addManager = useAddManager(projectId);
  const removeManager = useRemoveManager(projectId);
  const managerPending = addManager.isPending || removeManager.isPending;

  const managerSet = useMemo(() => new Set(managerIds), [managerIds]);

  const handleManagerToggle = (member: ProjectMember, next: boolean) => {
    const mutation = next ? addManager : removeManager;
    mutation.mutate(member.id, {
      onSuccess: () =>
        toast.success(
          next
            ? `${member.name} ahora puede editar y configurar el proyecto`
            : `${member.name} ya no puede editar ni configurar el proyecto`,
        ),
      onError: (err) => toast.error(memberErrorMessage(err)),
    });
  };

  // Miembro pendiente de traspaso (tras un 409) + destinatario elegido.
  const [pendingRemoval, setPendingRemoval] = useState<ProjectMember | null>(
    null,
  );
  const [reassignTo, setReassignTo] = useState('');

  const memberIds = useMemo(
    () => new Set((members ?? []).map((m) => m.id)),
    [members],
  );

  const handleAdd = (user: UserDirectoryEntry) => {
    addMember.mutate(user.id, {
      onSuccess: () => toast.success(`${user.name} añadido al proyecto`),
      onError: (err) => toast.error(memberErrorMessage(err)),
    });
  };

  const handleRemove = (member: ProjectMember) => {
    removeMember.mutate(
      { userId: member.id },
      {
        onSuccess: () => toast.success(`${member.name} quitado del proyecto`),
        onError: (err) => {
          if (
            err instanceof ApiError &&
            err.code === 'MEMBER_HAS_OPEN_ASSIGNMENTS'
          ) {
            // Abre el diálogo de traspaso en vez de fallar en seco.
            setReassignTo('');
            setPendingRemoval(member);
            return;
          }
          toast.error(memberErrorMessage(err));
        },
      },
    );
  };

  const handleReassignConfirm = () => {
    if (!pendingRemoval || !reassignTo) return;
    const member = pendingRemoval;
    removeMember.mutate(
      { userId: member.id, reassignTo },
      {
        onSuccess: () => {
          toast.success(
            `${member.name} quitado; sus tareas abiertas se traspasaron`,
          );
          setPendingRemoval(null);
        },
        onError: (err) => toast.error(memberErrorMessage(err)),
      },
    );
  };

  // Destinatarios posibles: miembros distintos del que se está quitando.
  const reassignCandidates = (members ?? []).filter(
    (m) => m.id !== pendingRemoval?.id,
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-on-surface">
          Miembros del proyecto
          {members && (
            <span className="ml-1.5 font-normal text-on-surface-variant">
              ({members.length})
            </span>
          )}
        </p>
        {canManage && (
          <MemberPicker
            excludeIds={memberIds}
            onSelect={handleAdd}
            disabled={addMember.isPending}
            trigger={
              <Button type="button" variant="outline" size="sm">
                {addMember.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <UserPlus />
                )}
                Añadir
              </Button>
            }
          />
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-on-surface-variant">
          <Loader2 className="size-4 animate-spin" />
          Cargando miembros…
        </div>
      ) : (
        <ul className="space-y-2">
          {(members ?? []).map((member) => {
            const isCreator = member.id === createdBy;
            const isManager = managerSet.has(member.id);
            return (
              <li
                key={member.id}
                className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <AuthedAvatar
                    size="sm"
                    avatarDownloadUrl={member.avatarDownloadUrl}
                    name={member.name}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-on-surface">
                    {member.name}
                  </span>
                  {isCreator ? (
                    <span className="shrink-0 text-xs font-medium text-on-surface-variant">
                      Creador
                    </span>
                  ) : canManage ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleRemove(member)}
                      disabled={removeMember.isPending}
                      aria-label={`Quitar a ${member.name} del proyecto`}
                      className="text-on-surface-variant hover:text-error"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : (
                    isManager && (
                      <span className="shrink-0 text-xs font-medium text-primary">
                        Gestor
                      </span>
                    )
                  )}
                </div>

                {/* Permiso de gestión por miembro (§3.20, P2): solo el creador/ADMIN lo
                    otorga/revoca; el creador es gestor implícito (sin toggle). */}
                {!isCreator && canManage && (
                  <label className="mt-2 flex items-center justify-between gap-3 rounded-md bg-surface-container-low px-2.5 py-1.5">
                    <span className="text-xs text-on-surface-variant">
                      Puede editar y configurar el proyecto
                    </span>
                    <Switch
                      checked={isManager}
                      disabled={managerPending}
                      onCheckedChange={(next) => handleManagerToggle(member, next)}
                      aria-label={`Permitir a ${member.name} editar y configurar el proyecto`}
                    />
                  </label>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Diálogo de traspaso (409 MEMBER_HAS_OPEN_ASSIGNMENTS) */}
      <Dialog
        open={!!pendingRemoval}
        onOpenChange={(open) => {
          if (!open) setPendingRemoval(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Traspasar tareas abiertas</DialogTitle>
            <DialogDescription>
              {pendingRemoval?.name} tiene tareas abiertas en el proyecto. Elige
              a otro miembro para traspasárselas antes de quitarlo.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-1.5">
            <label
              htmlFor="reassign-to"
              className="text-sm font-medium text-on-surface"
            >
              Traspasar a
            </label>
            <NativeSelect
              id="reassign-to"
              value={reassignTo}
              onChange={(e) => setReassignTo(e.target.value)}
              aria-label="Miembro destinatario"
            >
              <NativeSelectOption value="" disabled>
                {reassignCandidates.length === 0
                  ? 'No hay otros miembros'
                  : 'Selecciona un miembro'}
              </NativeSelectOption>
              {reassignCandidates.map((m) => (
                <NativeSelectOption key={m.id} value={m.id}>
                  {m.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingRemoval(null)}
              disabled={removeMember.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleReassignConfirm}
              disabled={!reassignTo || removeMember.isPending}
            >
              {removeMember.isPending && <Loader2 className="animate-spin" />}
              Traspasar y quitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
