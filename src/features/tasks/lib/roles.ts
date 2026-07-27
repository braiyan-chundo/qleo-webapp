import type {
  Task,
  TaskAssignment,
  TaskAssignmentUser,
  TaskRole,
} from '../services/tasks.service';

// Reexport de la utilidad compartida para no duplicar la derivación del nombre (QL-32).
export { initials } from '@/shared/lib/initials';

/** Etiqueta legible en español para cada rol por tarea. */
export const TASK_ROLE_LABEL: Record<TaskRole, string> = {
  CREATOR: 'Creador',
  ASSIGNEE: 'Responsable',
  COLLABORATOR: 'Colaborador',
  OBSERVER: 'Observador',
};

/**
 * Clases de token M3 por rol. Elegidas para tener contraste **en claro y oscuro**
 * (Neon Tokyo). Evitamos `secondary` (daba verde-sobre-verde ilegible): el Creador usa
 * `primary` y el Responsable `tertiary`, ambos con su `on-*-container` correspondiente.
 */
export const TASK_ROLE_BADGE_CLASS: Record<TaskRole, string> = {
  CREATOR: 'bg-primary-container text-on-primary-container',
  ASSIGNEE: 'bg-tertiary-container text-on-tertiary-container',
  COLLABORATOR: 'bg-surface-container-high text-on-surface-variant',
  OBSERVER:
    'bg-transparent text-on-surface-variant border border-outline-variant/60',
};

/** Orden de prioridad para elegir el rol "destacado" a mostrar en la card. */
const ROLE_PRIORITY: TaskRole[] = [
  'ASSIGNEE',
  'CREATOR',
  'COLLABORATOR',
  'OBSERVER',
];

/** Índice de prioridad de un rol (menor = más importante). */
export function rolePriority(role: TaskRole): number {
  const idx = ROLE_PRIORITY.indexOf(role);
  return idx === -1 ? ROLE_PRIORITY.length : idx;
}

/**
 * (QL-192) **PODER** relativo de los roles. Distinto de {@link ROLE_PRIORITY}, que solo decide
 * qué rol se destaca visualmente: esto decide qué **permisos** tiene una persona cuando ostenta
 * varios roles a la vez (el Creador que además es Responsable de su propia tarea). Espeja
 * `ROLE_PRECEDENCE` de `tasks.service.ts` en el backend: si aquí y allí no coincidieran, la UI
 * ofrecería acciones que la API rechaza.
 */
const ROLE_POWER: Record<TaskRole, number> = {
  CREATOR: 4,
  ASSIGNEE: 3,
  COLLABORATOR: 2,
  OBSERVER: 1,
};

/**
 * ¿Puede el usuario mover esta tarea en el Kanban (QL-15)? Solo CREATOR/ASSIGNEE/
 * COLLABORATOR; OBSERVER y no-participante (`null`) no pueden (el backend además valida).
 */
export function canMoveTask(role: TaskRole | null): boolean {
  return role === 'CREATOR' || role === 'ASSIGNEE' || role === 'COLLABORATOR';
}

/**
 * (QL-192) Una **persona** de la tarea con TODOS los roles que ostenta.
 *
 * Desde QL-192 el Creador puede ser además el Responsable, así que `assignments[]` puede traer
 * **dos entradas con el mismo `userId`** (una `CREATOR` y otra `ASSIGNEE`): es el mismo ser
 * humano con doble rol y en la UI tiene que salir **una sola vez**. Renderizar
 * `assignments.map(...)` en crudo lo duplicaría (y falsearía cualquier contador de
 * participantes), así que toda lista de personas de una tarea pasa por aquí.
 */
export interface TaskParticipant {
  userId: string;
  /** Datos poblados del usuario (solo llegan en el detalle). */
  user?: TaskAssignmentUser;
  /** Todos sus roles, ordenados por {@link rolePriority}. Nunca vacío. */
  roles: TaskRole[];
  /** Rol destacado (el de mayor prioridad de presentación): el que manda para ordenar/resaltar. */
  primaryRole: TaskRole;
}

/**
 * (QL-192) Agrupa `assignments[]` **por persona**: una ficha por `userId` con todos sus roles.
 * Conserva el orden de primera aparición; los roles de cada uno se ordenan por
 * {@link rolePriority} (Responsable antes que Creador, como en los badges).
 */
export function taskParticipants(
  assignments: TaskAssignment[],
): TaskParticipant[] {
  const byUser = new Map<string, TaskParticipant>();

  for (const assignment of assignments) {
    const existing = byUser.get(assignment.userId);
    if (existing) {
      if (!existing.roles.includes(assignment.role)) {
        existing.roles.push(assignment.role);
      }
      // El `user` poblado puede venir solo en una de las entradas: nos quedamos con la que haya.
      existing.user ??= assignment.user;
      continue;
    }
    byUser.set(assignment.userId, {
      userId: assignment.userId,
      user: assignment.user,
      roles: [assignment.role],
      primaryRole: assignment.role,
    });
  }

  return [...byUser.values()].map((participant) => {
    const roles = [...participant.roles].sort(
      (a, b) => rolePriority(a) - rolePriority(b),
    );
    return { ...participant, roles, primaryRole: roles[0] };
  });
}

/**
 * Participantes (ya deduplicados por persona) con el **Responsable primero**, para que sea el
 * avatar que siempre sobrevive al recorte de las cards. El resto conserva su orden original.
 */
export function participantsAssigneeFirst(
  assignments: TaskAssignment[],
): TaskParticipant[] {
  const participants = taskParticipants(assignments);
  const idx = participants.findIndex((p) => p.roles.includes('ASSIGNEE'));
  if (idx <= 0) return participants;
  return [
    participants[idx],
    ...participants.filter((_, i) => i !== idx),
  ];
}

/** El `TaskAssignment` del Responsable (ASSIGNEE, único por RF-1.2) de una tarea, si existe. */
export function assigneeOf(task: Task): TaskAssignment | undefined {
  return task.assignments.find((a) => a.role === 'ASSIGNEE');
}

/**
 * (QL-192) TODOS los roles del usuario en la tarea, ordenados por {@link rolePriority}. Vacío si
 * no participa. Es la lectura correcta desde que una persona puede ser Creador **y** Responsable.
 */
export function rolesOfUser(
  assignments: TaskAssignment[],
  userId: string | undefined,
): TaskRole[] {
  if (!userId) return [];
  return assignments
    .filter((a) => a.userId === userId)
    .map((a) => a.role)
    .sort((a, b) => rolePriority(a) - rolePriority(b));
}

/** ¿El usuario ostenta ese rol en la tarea? Cuenta el doble rol Creador+Responsable (QL-192). */
export function userHasRole(
  assignments: TaskAssignment[],
  userId: string | undefined,
  role: TaskRole,
): boolean {
  if (!userId) return false;
  return assignments.some((a) => a.userId === userId && a.role === role);
}

/**
 * (QL-192) Rol **efectivo** del usuario en la tarea: el de mayor {@link ROLE_POWER} entre los que
 * ostenta, o `null` si no participa. Es lo que debe gobernar los permisos de la UI en lugar de
 * `task.currentUserRole`, que es un escalar y no puede expresar el doble rol Creador+Responsable
 * (un Creador autoasignado seguiría siendo el dueño de la tarea, no "solo" su Responsable).
 *
 * Cae en `currentUserRole` cuando no se conoce el id del usuario (sesión aún sin resolver).
 */
export function effectiveTaskRole(
  task: Pick<Task, 'assignments' | 'currentUserRole'>,
  userId: string | undefined,
): TaskRole | null {
  if (!userId) return task.currentUserRole;
  const roles = rolesOfUser(task.assignments, userId);
  if (roles.length === 0) return null;
  return roles.reduce((best, role) =>
    ROLE_POWER[role] > ROLE_POWER[best] ? role : best,
  );
}

/** Etiquetas de varios roles en una sola línea: `Creador · Responsable`. */
export function formatRoles(roles: TaskRole[]): string {
  return roles.map((role) => TASK_ROLE_LABEL[role]).join(' · ');
}
