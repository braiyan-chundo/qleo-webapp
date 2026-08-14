import { BadgeCheck, Hourglass, ThumbsDown, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { OpenEndedStatus, Task } from '../../services/tasks.service';
import { OPEN_ENDED_PRESENTATION } from '../../lib/open-ended';

/** Icono de cada estado. Reloj = esperando, pulgar = denegado, sello = autorizado. */
const STATUS_ICON: Record<OpenEndedStatus, LucideIcon> = {
  PENDING: Hourglass,
  REJECTED: ThumbsDown,
  APPROVED: BadgeCheck,
};

interface OpenEndedChipProps {
  task: Pick<Task, 'openEndedStatus'>;
  className?: string;
}

/**
 * (QL-197, §3.69) Chip del estado de la **fecha de fin abierta**, para donde antes se pintaba la
 * fecha límite: la tarjeta del Kanban, la lista y el vistazo rápido. Devuelve `null` cuando la
 * tarea no tiene solicitud, que es el caso normal y el de todo el histórico.
 *
 * Existe como componente y no copiado en cada vista porque `dueDate: null` dejó de significar
 * una sola cosa: en una tarea antigua es "nadie le puso fecha" y en una con solicitud es un
 * estado con nombre —y con consecuencias— propio. Pintar `—` en los tres sitios volvía a
 * confundirlos.
 */
export function OpenEndedChip({ task, className }: OpenEndedChipProps) {
  const status = task.openEndedStatus;
  if (!status) return null;

  const presentation = OPEN_ENDED_PRESENTATION[status];
  const Icon = STATUS_ICON[status];

  return (
    <span
      title={presentation.description}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        presentation.badgeClass,
        className,
      )}
    >
      <Icon className="size-3" />
      {presentation.label}
    </span>
  );
}
