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
 * (QL-179, §3.58 §5) Etiqueta en español de cada clave del diff que escribe `PATCH /tasks/:id`.
 * Una clave **desconocida** no se esconde: se pinta con su nombre crudo, para tolerar campos
 * que el backend añada más adelante sin tocar el front.
 */
const DIFF_LABELS: Record<string, string> = {
  title: 'Título',
  description: 'Descripción',
  column: 'Columna',
  label: 'Etiqueta',
  startDate: 'Fecha de inicio',
  dueDate: 'Fecha límite',
  deadlineLocked: 'Bloqueo de fecha',
  assignee: 'Responsable',
  collaborators: 'Colaboradores',
  observers: 'Observadores',
};

/** Marcador de "sin valor" (nulo, cadena vacía o lista vacía). */
const EMPTY_VALUE = '—';

/** ¿La cadena parece un ISO8601 con hora? (los valores de fecha del diff llegan así). */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/**
 * (QL-179) Formatea un valor del diff para pintarlo. El backend garantiza **primitivos
 * pintables** (`string | boolean | null | string[]`, nunca ObjectIds), así que no hay que
 * resolver nada contra la API; el `String()` final solo cubre tipos futuros inesperados.
 */
function formatDiffValue(value: unknown): string {
  if (Array.isArray(value)) {
    const items = value.map((v) => String(v)).filter(Boolean);
    return items.length ? items.join(', ') : EMPTY_VALUE;
  }
  if (value === null || value === undefined || value === '') return EMPTY_VALUE;
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'string') {
    return ISO_DATE_RE.test(value) ? formatDateTime(value) : value;
  }
  return String(value);
}

/**
 * (QL-179) Claves del diff en orden estable: primero las conocidas (en el orden del mapa, que
 * va de lo más general a lo más específico) y después las desconocidas, alfabéticas. Se toma la
 * **unión** de `oldValues`/`newValues`: el contrato promete las mismas claves en ambos, pero un
 * diff parcial no debe perder información.
 */
function diffKeys(
  oldValues: Record<string, unknown>,
  newValues: Record<string, unknown>,
): string[] {
  const keys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);
  const known = Object.keys(DIFF_LABELS).filter((k) => keys.has(k));
  const unknown = [...keys].filter((k) => !(k in DIFF_LABELS)).sort();
  return [...known, ...unknown];
}

/**
 * (QL-144) Sección **solo-ADMIN** del detalle de tarea: historial de auditoría de la propia
 * tarea (`GET /audit/TASK/:taskId`). Lista quién hizo qué y cuándo (actor, acción, fecha),
 * reutilizando el formato de acciones de `AuditLogPage`. El llamador (`TaskDetailPage`) ya
 * gatea por rol de plataforma; el endpoint además exige ADMIN (403 si no).
 *
 * (QL-179, §3.58 §5) Las entradas de `PATCH /tasks/:id` traen además **qué** cambió:
 * `oldValues`/`newValues` con las mismas claves y solo las que cambiaron de verdad, ya
 * resueltas a valores pintables. Se listan debajo como `Etiqueta: viejo → nuevo`. El resto de
 * mutaciones (mover, cerrar, validar, descartar…) sigue con la auditoría genérica y
 * `oldValues: {}`: esas entradas se pintan como siempre, sin diff.
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
              // (QL-179) Solo las entradas semánticas de `PATCH /tasks/:id` traen `oldValues`
              // poblado; la auditoría genérica lo deja `{}` y se pinta sin diff.
              const oldValues = log.oldValues ?? {};
              const newValues = log.newValues ?? {};
              const changes = Object.keys(oldValues).length
                ? diffKeys(oldValues, newValues)
                : [];
              return (
                <li key={log._id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-3">
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
                  </div>

                  {changes.length > 0 && (
                    <ul className="mt-2 space-y-1 border-l-2 border-outline-variant/60 pl-3">
                      {changes.map((key) => (
                        <li key={key} className="text-xs text-on-surface-variant">
                          <span className="font-medium text-on-surface">
                            {DIFF_LABELS[key] ?? key}:
                          </span>{' '}
                          <span className="line-through decoration-outline">
                            {formatDiffValue(oldValues[key])}
                          </span>{' '}
                          <span aria-hidden="true">→</span>{' '}
                          <span className="font-medium text-on-surface">
                            {formatDiffValue(newValues[key])}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
