import { useEffect, useMemo, useRef, useState } from 'react';
import { History } from 'lucide-react';

import {
  useQueryParamNumber,
  useQueryParamState,
} from '@/shared/hooks/use-query-param-state';
import {
  AvatarCell,
  DataCard,
  DataCardRow,
  DataTableCard,
  TablePagination,
} from '@/shared/components/data-table';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { useAuditLog } from '../hooks/use-audit';
import type { AuditAction, AuditLog } from '../types/audit';

const PAGE_SIZE = 15;

const ALL = 'ALL';

const ENTITY_TYPES = ['PROJECT', 'TASK', 'USER', 'STAGE', 'COLUMN'] as const;

type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'ghost';

/** Colorea el badge de acción por tipo (tokens vía variantes del componente). */
const ACTION_META: Record<AuditAction, { label: string; variant: BadgeVariant }> = {
  CREATE: { label: 'Creación', variant: 'default' },
  UPDATE: { label: 'Actualización', variant: 'secondary' },
  DELETE: { label: 'Eliminación', variant: 'destructive' },
  ASSIGN: { label: 'Asignación', variant: 'outline' },
  COMPLETE: { label: 'Completada', variant: 'outline' },
  REOPEN: { label: 'Reapertura', variant: 'outline' },
};

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function shortId(id?: string): string {
  if (!id) return '—';
  return id.length > 10 ? `…${id.slice(-6)}` : id;
}

function isEmpty(obj: Record<string, unknown> | undefined): boolean {
  return !obj || Object.keys(obj).length === 0;
}

export function AuditLogPage() {
  // Filtro + paginación persistidos en la URL (params: `entidad`, `page`).
  const [entityType, setEntityType] = useQueryParamState('entidad', ALL);
  const [page, setPage] = useQueryParamNumber('page', 1);
  const [selected, setSelected] = useState<AuditLog | null>(null);

  // Al cambiar el filtro, vuelve a la primera página; omite el primer render (page de la URL).
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setPage(1);
    // Intencionalmente reacciona solo al filtro (no a `setPage`).
  }, [entityType]);

  const params = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      entityType: entityType === ALL ? undefined : entityType,
    }),
    [page, entityType],
  );

  const { data, isLoading, isError, error, isFetching } = useAuditLog(params);

  const logs = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-4 md:p-8">
      {/* Encabezado */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-on-surface">
            Historial de cambios
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Quién hizo qué y cuándo. Toda mutación del sistema se registra
            automáticamente.
          </p>
        </div>

        <Select value={entityType} onValueChange={setEntityType}>
          <SelectTrigger className="h-10 w-48">
            <SelectValue placeholder="Tipo de entidad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas las entidades</SelectItem>
            {ENTITY_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Contenido */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-error/20 bg-error-container px-6 py-10 text-center">
          <p className="text-sm font-medium text-on-error-container">
            No se pudo cargar el historial
          </p>
          <p className="mt-1 text-xs text-on-error-container/80">
            {error instanceof Error ? error.message : 'Error desconocido'}
          </p>
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant/60 bg-surface-container-low px-6 py-16 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-primary-container text-primary">
            <History className="size-7" />
          </div>
          <h2 className="text-lg font-semibold text-on-surface">
            Sin registros
          </h2>
          <p className="mt-1 max-w-sm text-sm text-on-surface-variant">
            No hay cambios que coincidan con el filtro seleccionado.
          </p>
        </div>
      ) : (
        <>
          <DataTableCard
            cards={logs.map((log) => {
              const meta = ACTION_META[log.action] ?? {
                label: log.action,
                variant: 'secondary' as BadgeVariant,
              };
              const hasDetail =
                !isEmpty(log.oldValues) || !isEmpty(log.newValues);
              const actorSubtitle = [log.actorId?.email, log.actorId?.role]
                .filter(Boolean)
                .join(' · ');
              return (
                <DataCard key={log._id}>
                  <div className="flex items-start justify-between gap-3">
                    <AvatarCell
                      name={log.actorId?.name ?? 'Sistema'}
                      subtitle={actorSubtitle || undefined}
                    />
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                  </div>
                  <DataCardRow label="Entidad">{log.entityType}</DataCardRow>
                  <DataCardRow label="ID">
                    <span className="font-mono text-xs">
                      {shortId(log.entityId)}
                    </span>
                  </DataCardRow>
                  <DataCardRow label="Fecha">
                    {formatDateTime(log.createdAt)}
                  </DataCardRow>
                  <div className="flex justify-end pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!hasDetail}
                      onClick={() => setSelected(log)}
                    >
                      Ver detalle
                    </Button>
                  </div>
                </DataCard>
              );
            })}
          >
            <TableHeader>
              <TableRow>
                <TableHead>Actor</TableHead>
                <TableHead>Acción</TableHead>
                <TableHead>Entidad</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => {
                const meta = ACTION_META[log.action] ?? {
                  label: log.action,
                  variant: 'secondary' as BadgeVariant,
                };
                const hasDetail =
                  !isEmpty(log.oldValues) || !isEmpty(log.newValues);
                const actorSubtitle = [
                  log.actorId?.email,
                  log.actorId?.role,
                ]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <TableRow key={log._id}>
                    <TableCell>
                      <AvatarCell
                        name={log.actorId?.name ?? 'Sistema'}
                        subtitle={actorSubtitle || undefined}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </TableCell>
                    <TableCell className="text-on-surface">
                      {log.entityType}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-on-surface-variant">
                      {shortId(log.entityId)}
                    </TableCell>
                    <TableCell className="text-on-surface-variant">
                      {formatDateTime(log.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!hasDetail}
                        onClick={() => setSelected(log)}
                      >
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </DataTableCard>

          <TablePagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            itemLabel={total === 1 ? 'registro' : 'registros'}
            disabled={isFetching}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
          />
        </>
      )}

      {/* Detalle del cambio */}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle del cambio</DialogTitle>
            <DialogDescription>
              {selected
                ? `${selected.entityType} · ${
                    ACTION_META[selected.action]?.label ?? selected.action
                  } · ${formatDateTime(selected.createdAt)}`
                : ''}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <span className="text-xs font-semibold text-on-surface-variant uppercase">
                  Valores previos
                </span>
                <pre className="max-h-72 overflow-auto rounded-lg border border-outline-variant/50 bg-surface-container-low p-3 text-xs text-on-surface">
                  {isEmpty(selected.oldValues)
                    ? '—'
                    : JSON.stringify(selected.oldValues, null, 2)}
                </pre>
              </div>
              <div className="grid gap-1.5">
                <span className="text-xs font-semibold text-on-surface-variant uppercase">
                  Valores nuevos
                </span>
                <pre className="max-h-72 overflow-auto rounded-lg border border-outline-variant/50 bg-surface-container-low p-3 text-xs text-on-surface">
                  {isEmpty(selected.newValues)
                    ? '—'
                    : JSON.stringify(selected.newValues, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
