import { History } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AvatarCell } from '@/shared/components/data-table';

import { useTaskAuditLog } from '@/features/audit/hooks/use-audit';
import type { AuditAction } from '@/features/audit/types/audit';

interface TaskAuditLogSectionProps {
  taskId: string;
}

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

/** Etiqueta y color del badge por acción (mismo criterio que `AuditLogPage`, §3.3). */
const ACTION_META: Record<AuditAction, { label: string; variant: BadgeVariant }> = {
  CREATE: { label: 'Creación', variant: 'default' },
  UPDATE: { label: 'Actualización', variant: 'secondary' },
  DELETE: { label: 'Eliminación', variant: 'destructive' },
  ASSIGN: { label: 'Asignación', variant: 'outline' },
  COMPLETE: { label: 'Completada', variant: 'outline' },
  REOPEN: { label: 'Reapertura', variant: 'outline' },
};

function actionMeta(action: string): { label: string; variant: BadgeVariant } {
  return ACTION_META[action as AuditAction] ?? { label: action, variant: 'secondary' };
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * (QL-144) Sección **solo-ADMIN** del detalle de tarea: historial de auditoría de la propia
 * tarea (`GET /audit/TASK/:taskId`). Lista quién hizo qué y cuándo (actor, acción, fecha),
 * reutilizando el formato de acciones de `AuditLogPage`. El llamador (`TaskDetailPage`) ya
 * gatea por rol de plataforma; el endpoint además exige ADMIN (403 si no).
 */
export function TaskAuditLogSection({ taskId }: TaskAuditLogSectionProps) {
  const { data: logs, isLoading, isError, error } = useTaskAuditLog(taskId);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-on-surface">
          <History className="size-5 text-on-surface-variant" />
          Historial de cambios
        </h2>
        <span className="rounded-full bg-secondary-container px-2 py-0.5 text-xs font-medium text-on-secondary-container">
          Solo administradores
        </span>
      </div>

      <div className="rounded-xl border border-outline-variant/50 bg-surface-container-low p-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-lg border border-error/20 bg-error-container px-4 py-6 text-center">
            <p className="text-sm font-medium text-on-error-container">
              No se pudo cargar el historial
            </p>
            <p className="mt-1 text-xs text-on-error-container/80">
              {error instanceof Error ? error.message : 'Error desconocido'}
            </p>
          </div>
        ) : !logs || logs.length === 0 ? (
          <p className="py-6 text-center text-sm text-on-surface-variant">
            Sin registros de auditoría para esta tarea.
          </p>
        ) : (
          <ul className="divide-y divide-outline-variant/40">
            {logs.map((log) => {
              const meta = actionMeta(log.action);
              const subtitle = [log.actorId?.email, log.actorId?.role]
                .filter(Boolean)
                .join(' · ');
              return (
                <li
                  key={log._id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <AvatarCell
                    name={log.actorId?.name ?? 'Sistema'}
                    subtitle={subtitle || undefined}
                  />
                  <div className="flex shrink-0 items-center gap-3">
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                    <time className="text-xs text-on-surface-variant tabular-nums">
                      {formatDateTime(log.createdAt)}
                    </time>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
