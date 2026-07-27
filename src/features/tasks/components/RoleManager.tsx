import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Trash2, UserPlus } from 'lucide-react';

import { ApiError } from '@/core/api/fetch-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { cn } from '@/lib/utils';
import { AuthedAvatar } from '@/shared/components/AuthedAvatar';
import { useAuthStore } from '@/store/auth.store';

import { useProjectMembers } from '@/features/projects/hooks/use-projects';

import { useAssignRole, useRemoveRole, useUpdateTask } from '../hooks/use-tasks';
import type { Task, TaskRole } from '../services/tasks.service';
import {
  TASK_ROLE_BADGE_CLASS,
  TASK_ROLE_LABEL,
  assigneeOf,
  taskParticipants,
  userHasRole,
} from '../lib/roles';

interface RoleManagerProps {
  task: Task;
}

/**
 * Roles que se asignan desde la lista/el picker de participantes. El `CREATOR` se siembra al
 * crear la tarea y es intocable; el `ASSIGNEE` (QL-192) tiene su propio selector arriba, porque
 * ya no es "un rol más": toda tarea tiene Responsable siempre y solo se puede **reasignar**.
 */
const ASSIGNABLE_ROLES: TaskRole[] = ['COLLABORATOR', 'OBSERVER'];

/** Traduce un `error.code` de negocio a un mensaje claro para el usuario. */
function roleErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'SINGLE_ASSIGNEE_REQUIRED':
        return 'Solo puede haber un Responsable por tarea. Cámbialo desde el selector de Responsable.';
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
 * Gestión de la matriz de roles por tarea (QL-08). La lista de participantes siempre se
 * muestra; las acciones de mutación (cambiar/quitar/añadir) solo si el usuario actual es el
 * CREATOR de la tarea. El picker se alimenta de la **membresía del proyecto**
 * (`GET /projects/:id/members`, QL-52): solo se puede asignar a miembros del proyecto, no al
 * directorio global. Para gestionar quién es miembro se usa el panel de miembros del proyecto.
 *
 * (QL-192) El Creador **puede ser el Responsable** de su propia tarea, así que:
 *  - Una persona puede tener DOS roles a la vez y se muestra en **una sola fila** con ambos
 *    badges (`taskParticipants` agrupa por `userId`).
 *  - El Responsable se elige en un **selector propio** que no admite "sin responsable": una
 *    tarea nunca se queda sin él, solo se **reasigna**. Va por `PATCH /tasks/:id`
 *    (`assigneeId`), que sustituye al anterior sin el 409 `SINGLE_ASSIGNEE_REQUIRED` que
 *    devolvería `POST /tasks/:id/roles` ahora que toda tarea nace con Responsable.
 */
export function RoleManager({ task }: RoleManagerProps) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  // (QL-192) El rol propio se deriva de `assignments`: un Creador autoasignado sigue siendo el
  // dueño de la tarea aunque su rol "principal" pase a ser Responsable.
  const isCreator = userHasRole(task.assignments, currentUserId, 'CREATOR');

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
  const updateTask = useUpdateTask(task.projectId);

  // (QL-192) Una ficha por persona con TODOS sus roles (el Creador-Responsable trae dos
  // entradas en `assignments` y saldría duplicado si se mapeara en crudo).
  const participants = useMemo(
    () => taskParticipants(task.assignments),
    [task.assignments],
  );

  const assignee = assigneeOf(task);
  const assigneeId = assignee?.userId ?? '';

  // Miembros del proyecto que aún no participan en la tarea (candidatos a añadir),
  // filtrados en cliente por el término de búsqueda (la lista de miembros es acotada).
  const assignedIds = useMemo(
    () => new Set(participants.map((p) => p.userId)),
    [participants],
  );
  const candidates = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (members ?? []).filter(
      (m) =>
        !assignedIds.has(m.id) &&
        (!term || m.name.toLowerCase().includes(term)),
    );
  }, [members, assignedIds, search]);

  /**
   * (QL-192) Opciones del selector de Responsable: TODOS los miembros del proyecto —incluido el
   * Creador y el propio usuario, que ya pueden autoasignarse—. Se garantiza que el Responsable
   * actual figure aunque ya no sea miembro del proyecto, para no perder el valor seleccionado.
   */
  const assigneeOptions = useMemo(() => {
    const map = new Map<string, string>();
    (members ?? []).forEach((m) => map.set(m.id, m.name));
    if (assigneeId && !map.has(assigneeId)) {
      map.set(assigneeId, assignee?.user?.name ?? assigneeId);
    }
    return [...map.entries()]
      .map(([userId, name]) => ({ userId, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [members, assigneeId, assignee]);

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

  /**
   * (QL-192) Reasigna el Responsable. Nunca se envía `null`: el selector no ofrece vaciarlo
   * (el backend lo devolvería al Creador) y la única forma de dejar de ser Responsable es
   * nombrar a otra persona.
   */
  const handleAssigneeChange = (userId: string) => {
    if (!userId || userId === assigneeId) return;
    updateTask.mutate(
      { id: task.id, data: { assigneeId: userId } },
      {
        onSuccess: () => toast.success('Responsable actualizado'),
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

      {/* (QL-192) Responsable: siempre hay uno y solo se puede REASIGNAR. Sin opción vacía. */}
      {isCreator && (
        <div className="grid gap-1.5 rounded-lg border border-outline-variant/40 bg-surface-container-low p-3">
          <Label htmlFor="task-assignee" className="text-xs font-semibold text-on-surface-variant">
            Responsable
          </Label>
          <NativeSelect
            id="task-assignee"
            className="w-full [&>select]:h-9"
            value={assigneeId}
            disabled={membersLoading || updateTask.isPending}
            onChange={(e) => handleAssigneeChange(e.target.value)}
            aria-label="Responsable de la tarea"
          >
            {!assigneeId && (
              <NativeSelectOption value="" disabled>
                {membersLoading ? 'Cargando miembros…' : 'Selecciona un Responsable'}
              </NativeSelectOption>
            )}
            {assigneeOptions.map((option) => (
              <NativeSelectOption key={option.userId} value={option.userId}>
                {option.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <span className="text-xs text-on-surface-variant">
            Toda tarea tiene un Responsable. Para dejar de serlo, asigna a otra persona.
          </span>
        </div>
      )}

      {/* Lista de participantes (una fila por persona, con todos sus roles). */}
      <ul className="space-y-2">
        {participants.map((p) => {
          // El Creador es intocable, y el Responsable solo se cambia desde el selector de
          // arriba (una tarea nunca se queda sin él): ni select de rol ni botón de quitar.
          const isFixed =
            p.roles.includes('CREATOR') || p.roles.includes('ASSIGNEE');
          return (
            <li
              key={p.userId}
              className="flex items-center gap-3 rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2"
            >
              <AuthedAvatar
                size="sm"
                avatarDownloadUrl={p.user?.avatarDownloadUrl}
                avatarUrl={p.user?.avatarUrl}
                name={p.user?.name ?? p.userId}
              />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-on-surface">
                  {p.user?.name ?? 'Usuario'}
                </p>
                {p.user?.email && (
                  <p className="truncate text-xs text-on-surface-variant">
                    {p.user.email}
                  </p>
                )}
              </div>

              {/* Cambiar rol: solo CREATOR, y solo sobre Colaboradores/Observadores. */}
              {isCreator && !isFixed ? (
                <NativeSelect
                  size="sm"
                  value={p.primaryRole}
                  disabled={assignRole.isPending}
                  onChange={(e) =>
                    handleAssign(p.userId, e.target.value as TaskRole)
                  }
                  aria-label={`Cambiar rol de ${p.user?.name ?? 'usuario'}`}
                >
                  {ASSIGNABLE_ROLES.map((role) => (
                    <NativeSelectOption key={role} value={role}>
                      {TASK_ROLE_LABEL[role]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              ) : (
                // (QL-192) Un badge por rol: el Creador autoasignado sale como
                // "Responsable · Creador" en una sola fila, no como dos participantes.
                <span className="flex shrink-0 flex-wrap justify-end gap-1">
                  {p.roles.map((role) => (
                    <Badge key={role} className={cn(TASK_ROLE_BADGE_CLASS[role])}>
                      {TASK_ROLE_LABEL[role]}
                    </Badge>
                  ))}
                </span>
              )}

              {/* Quitar: solo CREATOR, y nunca al Creador ni al Responsable de la tarea. */}
              {isCreator && !isFixed && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleRemove(p.userId)}
                  disabled={removeRole.isPending}
                  aria-label={`Quitar a ${p.user?.name ?? 'usuario'} de la tarea`}
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
