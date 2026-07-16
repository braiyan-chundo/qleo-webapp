import { useMemo, useState } from 'react';
import { BarChart3, Users } from 'lucide-react';

import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { useAuthStore } from '@/store/auth.store';
import { useProjects } from '@/features/projects/hooks/use-projects';

import {
  useAnalyticsOverview,
  useProjectAnalytics,
  useUsersPerformance,
} from '../hooks/use-analytics';
import {
  ChartState,
  StatTile,
  StatTileGrid,
} from '../components/analytics-primitives';
import { TasksByMemberCard } from '../components/TasksByMemberCard';
import { ThroughputChart } from '../components/ThroughputChart';
import { TimePerColumnChart } from '../components/TimePerColumnChart';
import { AttachmentsCard } from '../components/AttachmentsCard';
import { UserPerformanceCard } from '../components/UserPerformanceCard';

/**
 * Vista de Analíticas (QL-66, §3.24). Dos bloques:
 *  - **Resumen global** (solo ADMIN): totales, throughput y tareas por miembro del sistema.
 *  - **Por proyecto** (ADMIN o creador): selector de proyecto → tiempo por etapa, tareas por
 *    miembro, adjuntos y throughput del proyecto.
 * La ruta es autenticada (no solo-ADMIN) para que un creador consulte sus proyectos; el
 * backend autoriza cada endpoint. El acceso desde el menú es `adminOnly` (ver nav).
 */
export function AnalyticsPage() {
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const userId = useAuthStore((s) => s.user?.id);

  const overview = useAnalyticsOverview();
  const usersPerformance = useUsersPerformance();

  // Proyectos para el selector: ADMIN ve todos; un creador ve solo los suyos (evita 403).
  // `limit: 50` es el máximo que admite el DTO de paginación del backend (@Max(50)); pedir
  // más devolvía 400 y la sección "Por proyecto" no cargaba.
  const projectsQuery = useProjects({ limit: 50 });
  const selectableProjects = useMemo(() => {
    const all = projectsQuery.data?.data ?? [];
    return isAdmin ? all : all.filter((p) => p.createdBy === userId);
  }, [projectsQuery.data, isAdmin, userId]);

  const [selectedId, setSelectedId] = useState<string>('');
  const projectAnalytics = useProjectAnalytics(selectedId || undefined);
  const projectData = projectAnalytics.data;

  return (
    <div className="space-y-8 p-4 md:p-8">
      <header>
        <h1 className="text-3xl font-bold text-on-surface">Analíticas</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Métricas de uso y rendimiento de Qleo.
        </p>
      </header>

      {/* ── Resumen global (solo ADMIN) ── */}
      {isAdmin && (
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-on-surface">
            <BarChart3 className="size-5 text-on-surface-variant" />
            Resumen del sistema
          </h2>

          <ChartState
            isLoading={overview.isLoading}
            isError={overview.isError}
            isEmpty={!overview.data}
            errorMessage="No se pudo cargar el resumen global."
          >
            {overview.data && (
              <>
                <StatTileGrid>
                  <StatTile label="Proyectos" value={overview.data.totals.projects} />
                  <StatTile label="Tareas" value={overview.data.totals.tasks} />
                  <StatTile label="Abiertas" value={overview.data.totals.openTasks} />
                  <StatTile label="Cerradas" value={overview.data.totals.closedTasks} />
                  <StatTile
                    label="Vencidas"
                    value={overview.data.totals.overdueTasks}
                    tone="error"
                  />
                </StatTileGrid>

                <div className="grid gap-4 lg:grid-cols-2">
                  <ThroughputChart
                    points={overview.data.throughput}
                    isLoading={false}
                    isError={false}
                  />
                  <TasksByMemberCard
                    stats={overview.data.tasksByMember}
                    isLoading={false}
                    isError={false}
                  />
                </div>
              </>
            )}
          </ChartState>
        </section>
      )}

      {/* ── Rendimiento por usuario (solo ADMIN) ── */}
      {isAdmin && (
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-on-surface">
            <Users className="size-5 text-on-surface-variant" />
            Rendimiento por usuario
          </h2>
          <UserPerformanceCard
            users={usersPerformance.data}
            isLoading={usersPerformance.isLoading}
            isError={usersPerformance.isError}
          />
        </section>
      )}

      {/* ── Por proyecto ── */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-on-surface">Por proyecto</h2>
          <NativeSelect
            className="w-full max-w-xs sm:w-auto"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            aria-label="Seleccionar proyecto"
          >
            <NativeSelectOption value="">
              {selectableProjects.length > 0
                ? 'Selecciona un proyecto…'
                : 'No hay proyectos disponibles'}
            </NativeSelectOption>
            {selectableProjects.map((p) => (
              <NativeSelectOption key={p.id} value={p.id}>
                {p.name}
                {p.code ? ` · ${p.code}` : ''}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        {!selectedId ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-outline-variant/60 px-4 py-12 text-center">
            <BarChart3 className="size-6 text-on-surface-variant" />
            <p className="text-sm text-on-surface-variant">
              {selectableProjects.length > 0
                ? 'Elige un proyecto para ver sus métricas.'
                : isAdmin
                  ? 'Aún no hay proyectos.'
                  : 'No eres creador de ningún proyecto todavía.'}
            </p>
          </div>
        ) : (
          <ChartState
            isLoading={projectAnalytics.isLoading}
            isError={projectAnalytics.isError}
            isEmpty={!projectData}
            errorMessage="No se pudieron cargar las métricas de este proyecto (¿permisos?)."
          >
            {projectData && (
              <div className="space-y-4">
                <StatTileGrid>
                  <StatTile label="Tareas" value={projectData.totals.tasks} />
                  <StatTile label="Abiertas" value={projectData.totals.openTasks} />
                  <StatTile label="Cerradas" value={projectData.totals.closedTasks} />
                  <StatTile
                    label="Vencidas"
                    value={projectData.totals.overdueTasks}
                    tone="error"
                  />
                </StatTileGrid>

                <TimePerColumnChart
                  entries={projectData.timePerColumn}
                  isLoading={false}
                  isError={false}
                />

                <div className="grid gap-4 lg:grid-cols-2">
                  <TasksByMemberCard
                    stats={projectData.tasksByMember}
                    isLoading={false}
                    isError={false}
                  />
                  <ThroughputChart
                    points={projectData.throughput}
                    isLoading={false}
                    isError={false}
                  />
                </div>

                <AttachmentsCard
                  attachments={projectData.attachments}
                  flowDuration={projectData.flowDuration}
                />
              </div>
            )}
          </ChartState>
        )}
      </section>
    </div>
  );
}
