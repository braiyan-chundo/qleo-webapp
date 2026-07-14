import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ChevronRight,
  FolderKanban,
  History,
  RefreshCw,
  Shield,
  Users,
  UserCheck,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AuthedAvatar, identityAvatarFallback } from '@/shared/components/AuthedAvatar';
import { timeAgo } from '@/features/notifications/lib/notification-text';
import type { AuditAction } from '@/features/audit/types/audit';

import { useAdminDashboard } from '../hooks/use-admin-dashboard';
import type { AdminDashboard as AdminDashboardData, AuditSummary } from '../services/dashboard.service';
import { activityPhraseLabel, buildActivityPhrase } from '../lib/audit-activity';
import { AdminDashboardSkeleton } from './DashboardSkeleton';
import { RecentProjectsCard } from './RecentProjectsCard';
import { ThroughputAreaChart } from './charts/ThroughputAreaChart';
import { ActivityByDayChart } from './charts/ActivityByDayChart';
import { TasksByStatusChart } from './charts/TasksByStatusChart';
import { ProjectsByStatusChart } from './charts/ProjectsByStatusChart';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost';

/**
 * Etiqueta + variante de badge por acción de auditoría. Espeja el mapa de `AuditLogPage`
 * (§3.3) para mantener consistencia visual en todo el sistema sin duplicar estilos.
 */
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

/**
 * Dashboard ADMIN (QL-20 / QL-112) — resumen de sistema (`GET /dashboard/admin`, §3.14). Es
 * la landing del ADMIN. El dato del servidor vive en la caché de TanStack Query
 * (`useAdminDashboard`, con polling); muestra KPIs, 4 gráficas de series reales y la
 * actividad reciente **descriptiva con avatar** (QL-112).
 */
export function AdminDashboard() {
  const { data, isLoading, isError, error, refetch, isFetching } = useAdminDashboard();

  if (isLoading) {
    return <AdminDashboardSkeleton />;
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-error/20 bg-error-container/60 px-6 py-12 text-center">
        <AlertCircle className="mb-3 size-8 text-on-error-container" />
        <p className="text-sm font-medium text-on-error-container">
          No se pudo cargar el resumen de sistema
        </p>
        <p className="mt-1 text-xs text-on-error-container/80">
          {error instanceof Error ? error.message : 'Error desconocido'}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-5"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={isFetching ? 'animate-spin' : undefined} />
          Reintentar
        </Button>
      </div>
    );
  }

  const totalUsers = data.usersByRole.ADMIN + data.usersByRole.MEMBER;

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <header>
        <h1 className="text-3xl font-bold text-on-surface">Resumen de sistema</h1>
        <p className="mt-1 text-sm text-on-surface-variant">Monitoreo general de Qleo.</p>
      </header>

      {/* KPIs — solo métricas reales del endpoint. En móvil: 3 columnas compactas (QL-55). */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        <KpiCard
          icon={<FolderKanban className="size-4 sm:size-5" />}
          value={data.activeProjects}
          label="Proyectos activos"
        />
        <KpiCard
          icon={<UserCheck className="size-4 sm:size-5" />}
          value={data.activeUsers}
          label="Usuarios activos"
        />
        <KpiCard
          icon={<Users className="size-4 sm:size-5" />}
          value={totalUsers}
          label="Total de usuarios"
        />
      </div>

      {/* Proyectos recientes (QL-123): el cliente lo quiere **justo encima** de "Tareas cerradas
          por semana" (la primera gráfica). Se monta aquí solo para el ADMIN; el MEMBER lo recibe
          desde `DashboardPage` (su panel no tiene gráficas). Las dos ramas son excluyentes por
          rol → la tarjeta se renderiza exactamente una vez por usuario. */}
      <RecentProjectsCard />

      {/* Gráficas (QL-112): móvil apiladas, desktop 2×2. Sin overflow horizontal. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ThroughputAreaChart points={data.throughput} />
        <ActivityByDayChart points={data.activityByDay} />
        <TasksByStatusChart data={data.tasksByStatus} />
        <ProjectsByStatusChart data={data.projectsByStatus} />
      </div>

      {/* Actividad reciente enriquecida + Roles y permisos */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentAuditCard entries={data.recentAudit} />
        </div>
        <RolesCard usersByRole={data.usersByRole} total={totalUsers} />
      </div>
    </div>
  );
}

interface KpiCardProps {
  icon: React.ReactNode;
  value: number;
  label: string;
}

/** Tarjeta KPI: icono + número grande + etiqueta. Compacta en móvil (QL-55). */
function KpiCard({ icon, value, label }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-3 sm:p-5">
      {/* Par tonal legible (QL-40): icono `on-primary-container` sobre `primary-container`
          contrasta en claro y oscuro (antes `text-primary` se perdía sobre el fondo tenue). */}
      <div className="flex size-8 items-center justify-center rounded-lg bg-primary-container text-on-primary-container sm:size-10">
        {icon}
      </div>
      <p className="mt-3 text-xl font-bold tabular-nums text-on-surface sm:mt-4 sm:text-3xl">{value}</p>
      <p className="mt-1 text-[11px] leading-tight text-on-surface-variant sm:text-sm">{label}</p>
    </div>
  );
}

interface RecentAuditCardProps {
  entries: AuditSummary[];
}

/**
 * Registro de auditoría reciente (QL-112): avatar del actor + **frase legible** de la acción
 * (*"María completó la tarea «Reservar vuelos»"*) + antigüedad y badge de acción. Enlaza al
 * historial completo.
 */
function RecentAuditCard({ entries }: RecentAuditCardProps) {
  return (
    <section className="flex h-full flex-col rounded-xl border border-outline-variant/40 bg-surface-container-low p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-on-surface">Actividad reciente</h2>
        <Link
          to="/audit"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Ver todo
          <ChevronRight className="size-4" />
        </Link>
      </div>

      {entries.length > 0 ? (
        <ul className="space-y-1">
          {entries.map((entry) => {
            const meta = actionMeta(entry.action);
            const phrase = buildActivityPhrase(entry);
            return (
              <li
                key={entry.id}
                className="flex items-center gap-3 rounded-lg px-2 py-2"
              >
                <AuthedAvatar
                  avatarDownloadUrl={entry.actorAvatarUrl}
                  name={phrase.actor}
                  className="size-9 shrink-0 border border-outline-variant/50"
                  fallbackClassName={`${identityAvatarFallback} text-xs`}
                />
                <span className="min-w-0 flex-1">
                  <span
                    className="block truncate text-sm text-on-surface"
                    aria-label={activityPhraseLabel(phrase)}
                  >
                    <span className="font-semibold">{phrase.actor}</span> {phrase.action}
                    {phrase.entityName && (
                      <>
                        {' '}
                        <span className="text-on-surface-variant">«</span>
                        <span className="font-medium">{phrase.entityName}</span>
                        <span className="text-on-surface-variant">»</span>
                      </>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-on-surface-variant">
                    {timeAgo(entry.createdAt)}
                  </span>
                </span>
                <Badge variant={meta.variant} className="shrink-0">
                  {meta.label}
                </Badge>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-outline-variant/60 px-4 py-8 text-center">
          <History className="size-6 text-on-surface-variant" />
          <p className="text-sm font-medium text-on-surface">Sin actividad reciente</p>
          <p className="text-xs text-on-surface-variant">
            Las mutaciones del sistema aparecerán aquí.
          </p>
        </div>
      )}
    </section>
  );
}

interface RolesCardProps {
  usersByRole: AdminDashboardData['usersByRole'];
  total: number;
}

/** Desglose de usuarios por rol de plataforma con barra proporcional. */
function RolesCard({ usersByRole, total }: RolesCardProps) {
  const adminPct = total > 0 ? Math.round((usersByRole.ADMIN / total) * 100) : 0;
  const memberPct = total > 0 ? 100 - adminPct : 0;

  return (
    <section className="flex flex-col rounded-xl border border-outline-variant/40 bg-surface-container-low p-5">
      <div className="mb-4 flex items-center gap-2">
        <Shield className="size-4 text-on-surface-variant" />
        <h2 className="text-base font-semibold text-on-surface">Roles y permisos</h2>
      </div>

      {/* Barra proporcional */}
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-container-high">
        {total > 0 && (
          <>
            <div className="h-full bg-primary" style={{ width: `${adminPct}%` }} />
            <div className="h-full bg-tertiary" style={{ width: `${memberPct}%` }} />
          </>
        )}
      </div>

      {/* Leyenda / desglose */}
      <dl className="mt-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <dt className="inline-flex items-center gap-2 text-sm text-on-surface-variant">
            <span className="size-2.5 rounded-full bg-primary" />
            Administradores
          </dt>
          <dd className="text-sm font-semibold tabular-nums text-on-surface">
            {usersByRole.ADMIN}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="inline-flex items-center gap-2 text-sm text-on-surface-variant">
            <span className="size-2.5 rounded-full bg-tertiary" />
            Miembros
          </dt>
          <dd className="text-sm font-semibold tabular-nums text-on-surface">
            {usersByRole.MEMBER}
          </dd>
        </div>
      </dl>

      <Button asChild variant="outline" size="sm" className="mt-5 w-full">
        <Link to="/admin">Gestionar usuarios</Link>
      </Button>
    </section>
  );
}
