import { AuthedAvatar, identityAvatarFallback } from '@/shared/components/AuthedAvatar';

import { ChartCard, ChartState } from './analytics-primitives';
import type { MemberTaskStats } from '../services/analytics.service';

/**
 * 2.3 — Tareas por miembro. Barras HTML apiladas (cerradas + abiertas) con avatar y nombre.
 * Se usan barras HTML (en vez de Recharts) para poder mostrar el avatar autenticado en cada
 * fila. Identidad por leyenda + etiquetas numéricas, no solo por color (guía `dataviz`).
 * Ordenadas por participación total desc (el backend ya las entrega así).
 */
export function TasksByMemberCard({
  stats,
  isLoading,
  isError,
}: {
  stats: MemberTaskStats[] | undefined;
  isLoading: boolean;
  isError: boolean;
}) {
  const rows = stats ?? [];
  const maxTotal = rows.reduce((m, r) => Math.max(m, r.participating.total), 0) || 1;

  return (
    <ChartCard
      title="Tareas por miembro"
      description="Participación total (cualquier rol), cerradas vs. abiertas."
      action={
        rows.length > 0 ? (
          <div className="flex shrink-0 items-center gap-3 text-xs text-on-surface-variant">
            <span className="inline-flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: 'var(--primary)' }}
              />
              Cerradas
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: 'var(--tertiary)' }}
              />
              Abiertas
            </span>
          </div>
        ) : undefined
      }
    >
      <ChartState
        isLoading={isLoading}
        isError={isError}
        isEmpty={rows.length === 0}
        emptyMessage="Aún no hay tareas asignadas a miembros."
      >
        <ul className="space-y-3">
          {rows.map(({ user, participating }) => {
            const widthPct = (participating.total / maxTotal) * 100;
            const closedPct =
              participating.total > 0
                ? (participating.closed / participating.total) * 100
                : 0;
            return (
              <li key={user.id} className="flex items-center gap-3">
                <AuthedAvatar
                  avatarDownloadUrl={user.avatarDownloadUrl}
                  name={user.name}
                  className="size-8 shrink-0 border border-outline-variant/50"
                  fallbackClassName={`${identityAvatarFallback} text-xs`}
                />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-on-surface">
                      {user.name}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-on-surface-variant">
                      {participating.closed} cerr. · {participating.open} ab.
                    </span>
                  </div>
                  {/* Barra apilada: cerradas (primary) + abiertas (tertiary), con hueco de 2px. */}
                  <div
                    className="h-2.5 w-full overflow-hidden rounded-full bg-surface-container-high"
                    role="img"
                    aria-label={`${user.name}: ${participating.closed} cerradas, ${participating.open} abiertas`}
                  >
                    <div
                      className="flex h-full gap-px"
                      style={{ width: `${widthPct}%` }}
                    >
                      <div
                        className="h-full rounded-l-full"
                        style={{
                          width: `${closedPct}%`,
                          backgroundColor: 'var(--primary)',
                        }}
                      />
                      <div
                        className="h-full rounded-r-full"
                        style={{
                          width: `${100 - closedPct}%`,
                          backgroundColor: 'var(--tertiary)',
                        }}
                      />
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </ChartState>
    </ChartCard>
  );
}
