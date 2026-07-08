import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Trash2, UserPlus } from 'lucide-react';

import { ApiError } from '@/core/api/fetch-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { cn } from '@/lib/utils';
import { AuthedAvatar } from '@/shared/components/AuthedAvatar';

import { useProjectMembers } from '@/features/projects/hooks/use-projects';

import { useAssignRole, useRemoveRole } from '../hooks/use-tasks';
import type { Task, TaskRole } from '../services/tasks.service';
import {
  TASK_ROLE_BADGE_CLASS,
  TASK_ROLE_LABEL,
} from '../lib/roles';

interface RoleManagerProps {
  task: Task;
}

/** Roles asignables desde el picker (el CREATOR se siembra al crear la tarea). */
const ASSIGNABLE_ROLES: TaskRole[] = ['ASSIGNEE', 'COLLABORATOR', 'OBSERVER'];

/** Traduce un `error.code` de negocio a un mensaje claro para el usuario. */
function roleErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'SINGLE_ASSIGNEE_REQUIRED':
        return 'Ya hay un Responsable asignado. Solo puede haber uno por tarea.';
      case 'TASK_OWNERSHIP_REQUIRED':
        return 'Solo el Creador de la tarea puede gestionar los roles.';
      case 'READ_ONLY_ROLE':
        return 'No tienes permisos para esta acción (rol de solo lectura).';
      case 'USER_NOT_PROJECT_MEMBER':
        return 'Solo puedes asignar a miembros del proyecto.';
    }
  }
  return err instanceof Error ? err.message : 'No se pudo actualizar el rol';
}

/**
 * Gestión de la matriz de roles por tarea (QL-08). La lista de assignments siempre se
 * muestra; las acciones de mutación (cambiar/quitar/añadir) solo si el usuario actual es el
 * CREATOR de la tarea. El picker se alimenta de la **membresía del proyecto**
 * (`GET /projects/:id/members`, QL-52): solo se puede asignar a miembros del proyecto, no al
 * directorio global. Para gestionar quién es miembro se usa el panel de miembros del proyecto.
 */
export function RoleManager({ task }: RoleManagerProps) {
  const isCreator = task.currentUserRole === 'CREATOR';

  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<TaskRole>('COLLABORATOR');

  // El picker solo es visible (y por tanto la query solo se dispara) para el CREATOR.
  const { data: members, isLoading: membersLoading } = useProjectMembers(
    task.projectId,
    { enabled: isCreator },
  );

  const assignRole = useAssignRole(task.projectId, task.id);
  const removeRole = useRemoveRole(task.projectId, task.id);

  // Miembros del proyecto que aún no participan en la tarea (candidatos a añadir),
  // filtrados en cliente por el término de búsqueda (la lista de miembros es acotada).
  const assignedIds = useMemo(
    () => new Set(task.assignments.map((a) => a.userId)),
    [task.assignments],
  );
  const candidates = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (members ?? []).filter(
      (m) =>
        !assignedIds.has(m.id) &&
        (!term || m.name.toLowerCase().includes(term)),
    );
  }, [members, assignedIds, search]);

  const handleAssign = (userId: string, role: TaskRole) => {
    if (!userId) return;
    assignRole.mutate(
      { userId, role },
      {
        onSuccess: () => {
          toast.success('Rol actualizado');
          setSelectedUserId('');
        },
        onError: (err) => toast.error(roleErrorMessage(err)),
      },
    );
  };

  const handleRemove = (userId: string) => {
    removeRole.mutate(userId, {
      onSuccess: () => toast.success('Usuario retirado de la tarea'),
      onError: (err) => toast.error(roleErrorMessage(err)),
    });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-on-surface">
        Roles de la tarea
      </h3>

      {/* Lista de assignments */}
      <ul className="space-y-2">
        {task.assignments.map((a) => {
          const isTaskCreator = a.role === 'CREATOR';
          return (
            <li
              key={a.userId}
              className="flex items-center gap-3 rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2"
            >
              <AuthedAvatar
                size="sm"
                avatarDownloadUrl={a.user?.avatarDownloadUrl}
                avatarUrl={a.user?.avatarUrl}
                name={a.user?.name ?? a.userId}
              />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-on-surface">
                  {a.user?.name ?? 'Usuario'}
                </p>
                {a.user?.email && (
                  <p className="truncate text-xs text-on-surface-variant">
                    {a.user.email}
                  </p>
                )}
              </div>

              {/* Cambiar rol: solo CREATOR y no sobre el propio CREATOR de la tarea */}
              {isCreator && !isTaskCreator ? (
                <NativeSelect
                  size="sm"
                  value={a.role}
                  disabled={assignRole.isPending}
                  onChange={(e) =>
                    handleAssign(a.userId, e.target.value as TaskRole)
                  }
                  aria-label={`Cambiar rol de ${a.user?.name ?? 'usuario'}`}
                >
                  {ASSIGNABLE_ROLES.map((role) => (
                    <NativeSelectOption key={role} value={role}>
                      {TASK_ROLE_LABEL[role]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              ) : (
                <Badge
                  className={cn('shrink-0', TASK_ROLE_BADGE_CLASS[a.role])}
                >
                  {TASK_ROLE_LABEL[a.role]}
                </Badge>
              )}

              {/* Quitar: solo CREATOR y nunca al CREATOR de la tarea */}
              {isCreator && !isTaskCreator && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleRemove(a.userId)}
                  disabled={removeRole.isPending}
                  aria-label={`Quitar a ${a.user?.name ?? 'usuario'} de la tarea`}
                  className="text-on-surface-variant hover:text-error"
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      {/* Añadir usuario: solo CREATOR */}
      {isCreator && (
        <div className="rounded-lg border border-outline-variant/40 bg-surface-container-low p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant">
            <UserPlus className="size-3.5" />
            Añadir participante
          </p>

          <div className="space-y-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar miembro por nombre…"
              className="h-9"
              aria-label="Buscar miembro"
            />
            <div className="flex flex-wrap items-center gap-2">
              <NativeSelect
                className="min-w-[10rem] flex-1 [&>select]:h-9"
                value={selectedUserId}
                disabled={membersLoading}
                onChange={(e) => setSelectedUserId(e.target.value)}
                aria-label="Miembro a añadir"
              >
                <NativeSelectOption value="" disabled>
                  {membersLoading
                    ? 'Cargando miembros…'
                    : candidates.length === 0
                      ? 'Sin miembros disponibles'
                      : 'Selecciona un miembro'}
                </NativeSelectOption>
                {candidates.map((m) => (
                  <NativeSelectOption key={m.id} value={m.id}>
                    {m.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>

              <NativeSelect
                className="w-[9rem] [&>select]:h-9"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as TaskRole)}
                aria-label="Rol a asignar"
              >
                {ASSIGNABLE_ROLES.map((role) => (
                  <NativeSelectOption key={role} value={role}>
                    {TASK_ROLE_LABEL[role]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>

              <Button
                type="button"
                size="sm"
                onClick={() => handleAssign(selectedUserId, selectedRole)}
                disabled={!selectedUserId || assignRole.isPending}
              >
                {assignRole.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <UserPlus />
                )}
                Añadir
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
