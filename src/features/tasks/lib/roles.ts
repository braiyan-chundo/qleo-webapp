import type { TaskRole } from '../services/tasks.service';

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
 * ¿Puede el usuario mover esta tarea en el Kanban (QL-15)? Solo CREATOR/ASSIGNEE/
 * COLLABORATOR; OBSERVER y no-participante (`null`) no pueden (el backend además valida).
 */
export function canMoveTask(role: TaskRole | null): boolean {
  return role === 'CREATOR' || role === 'ASSIGNEE' || role === 'COLLABORATOR';
}

