import { Link } from 'react-router-dom';
import { ArrowUpRight, CopyCheck } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { Task } from '../../services/tasks.service';
import { formatDateTime } from '../../lib/time';

interface TaskOriginCardProps {
  task: Task;
  className?: string;
}

/**
 * (QL-201, §3.73 §0 §7) **Tarjeta de procedencia** de una tarea que nació como copia.
 *
 * Es la contrapartida de una decisión del backend, y por eso no es opcional: los `auditLogs` de la
 * original **no se clonan** a nombre de la copia. Escribir entradas sobre una entidad que no
 * existía cuando esos hechos ocurrieron convertiría el único registro fiable del sistema en
 * ficción, y contaminaría el panel de Auditoría, la actividad reciente y cualquier investigación
 * futura. Lo que se da en su lugar es **este enlace permanente**: el historial real sigue vivo en
 * la tarea de origen.
 *
 * De ahí que su sitio sea **abriendo el bloque de historial** (ver `TaskDetailPage`): el usuario
 * que busca "el historial de esta copia" va justo ahí, y ahí es donde tiene que encontrar el
 * camino al de verdad en vez de una lista con un solo renglón y ninguna explicación.
 *
 * Los **nombres** son la instantánea del momento de copiar y sobreviven a que renombren —o
 * borren— la original; el **enlace** usa la ruta plana `/tasks/:id`, que resuelve el proyecto y
 * degrada a un 404 de marca si la original ya no existe (QL-143), en vez de reventar.
 */
export function TaskOriginCard({ task, className }: TaskOriginCardProps) {
  const origin = task.duplicatedFrom;
  // El caso normal: la tarea no es una copia y no hay nada que contar.
  if (!task.isDuplicate || !origin) return null;

  return (
    <section
      className={cn(
        'rounded-lg border border-outline-variant/50 bg-surface-container-low px-4 py-3',
        className,
      )}
    >
      <p className="inline-flex items-center gap-1.5 text-xs font-medium text-on-surface-variant">
        <CopyCheck className="size-3.5" aria-hidden />
        Tarea duplicada
      </p>

      <p className="mt-1 text-sm text-on-surface">
        Copia de <span className="font-medium">«{origin.taskTitle}»</span>, del proyecto{' '}
        <span className="font-medium">«{origin.projectName}»</span>
        {task.duplicatedBy && <> · duplicada por {task.duplicatedBy.name}</>}
        {task.duplicatedAt && <> el {formatDateTime(task.duplicatedAt)}</>}.
      </p>

      <p className="mt-1.5 text-xs text-on-surface-variant">
        El historial de esta copia empieza aquí: lo anterior ocurrió en la tarea original, y ahí es
        donde sigue registrado.
      </p>

      <Link
        to={`/tasks/${origin.taskId}`}
        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        Ver la tarea original
        <ArrowUpRight className="size-3.5" aria-hidden />
      </Link>
    </section>
  );
}
