import { Ban, CircleCheck, Lock, type LucideIcon } from 'lucide-react';

import type { ReminderBlockedReason } from '../types/reminder.types';

/** Píldora y explicación de cada bloqueo por la tarea (D-12, AC-21, AC-23, maqueta). */
export const BLOCKED_TEXT: Record<
  ReminderBlockedReason,
  { label: string; why: string; icon: LucideIcon }
> = {
  TASK_COMPLETED: {
    label: 'En pausa · tarea completada',
    why: 'Vuelve a sonar si se reabre la tarea.',
    icon: CircleCheck,
  },
  TASK_DISCARDED: {
    label: 'En pausa · tarea descartada',
    why: 'Vuelve a sonar si se restaura la tarea.',
    icon: Ban,
  },
  NO_TASK_ACCESS: {
    label: 'En pausa · sin acceso a la tarea',
    why: 'Vuelve a sonar si recuperas el acceso.',
    icon: Lock,
  },
};
