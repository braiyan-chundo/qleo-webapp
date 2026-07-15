import { AuthedAvatar } from '@/shared/components/AuthedAvatar';
import { cn } from '@/lib/utils';

import { ChartCard, ChartState } from './analytics-primitives';
import { formatDuration } from '../lib/format';
import type { UserPerformance } from '../services/analytics.service';

interface UserPerformanceCardProps {
  users: UserPerformance[] | undefined;
  isLoading: boolean;
  isError: boolean;
}

/**
 * P6 (§3.24) — tabla de **rendimiento por usuario** (solo ADMIN). Una fila por usuario, ya
 * ordenada por eficiencia desc (backend). Duraciones humanizadas con el formateador de ms de
 * la analítica; la eficiencia se muestra como % con barra y color por umbral (tokens M3).
 * Responsiva: la tabla scrollea horizontalmente en pantallas estrechas.
 */
export function UserPerformanceCard({
  users,
  isLoading,
  isError,
}: UserPerformanceCardProps) {
  const rows = users ?? [];

  return (
    <ChartCard
      title="Rendimiento por usuario"
      description="Ordenado por eficiencia (a-tiempo × avance). La duración es tiempo hábil; el retraso, reloj de pared."
    >
      <ChartState
        isLoading={isLoading}
        isError={isError}
        isEmpty={rows.length === 0}
        errorMessage="No se pudo cargar el rendimiento por usuario."
        emptyMessage="Aún no hay datos de rendimiento."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-outline-variant/50 text-left text-xs text-on-surface-variant">
                <th className="py-2 pr-3 font-medium">Usuario</th>
                <th className="px-2 py-2 text-right font-medium">Proyectos</th>
                <th className="px-2 py-2 text-right font-medium">Asignadas</th>
                <th className="px-2 py-2 text-right font-medium">Totales</th>
                <th className="px-2 py-2 text-right font-medium">Finalizadas</th>
                <th className="px-2 py-2 text-right font-medium">A tiempo</th>
                <th className="px-2 py-2 text-right font-medium">Tarde</th>
                <th className="px-2 py-2 text-right font-medium">Duración prom.</th>
                <th className="px-2 py-2 text-right font-medium">Retraso prom.</th>
                <th className="py-2 pl-2 text-right font-medium">Eficiencia</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.user.id}
                  className="border-b border-outline-variant/25 last:border-0"
                >
                  <td className="py-2 pr-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <AuthedAvatar
                        size="sm"
                        avatarDownloadUrl={r.user.avatarDownloadUrl}
                        name={r.user.name}
                      />
                      <span className="truncate font-medium text-on-surface">
                        {r.user.name}
                      </span>
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-on-surface-variant">
                    {r.projects}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-on-surface-variant">
                    {r.assignedTasks}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-on-surface-variant">
                    {r.totalTasks}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-on-surface">
                    {r.completedTasks}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-on-surface">
                    {r.onTime}
                  </td>
                  <td
                    className={cn(
                      'px-2 py-2 text-right tabular-nums',
                      r.late > 0 ? 'text-error' : 'text-on-surface-variant',
                    )}
                  >
                    {r.late}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-on-surface-variant">
                    {formatDuration(r.avgDurationMs)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-on-surface-variant">
                    {formatDuration(r.avgDelayMs)}
                  </td>
                  <td className="py-2 pl-2">
                    <EfficiencyMeter value={r.efficiency} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartState>
    </ChartCard>
  );
}

/** Barra + % de eficiencia. Color por umbral con tokens M3 (verde/ámbar/rojo semánticos). */
function EfficiencyMeter({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const tone =
    pct >= 75 ? 'bg-primary' : pct >= 40 ? 'bg-tertiary' : 'bg-error';

  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-container-high">
        <div
          className={cn('h-full rounded-full', tone)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-9 text-right text-xs font-semibold tabular-nums text-on-surface">
        {pct}%
      </span>
    </div>
  );
}
