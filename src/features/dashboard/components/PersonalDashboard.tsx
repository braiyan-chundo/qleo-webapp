import { AlertCircle, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth.store';

import { useMyDashboard } from '../hooks/use-my-dashboard';
import { DashboardSkeleton } from './DashboardSkeleton';
import { MyTasksCard } from './MyTasksCard';
import { FocusProjectCard } from './FocusProjectCard';
import { RecentMentionsCard } from './RecentMentionsCard';
import { QuickActions } from './QuickActions';

/** Primer nombre del usuario (para el saludo). Cadena vacía si no hay nombre. */
function firstName(name: string | undefined): string {
  return name?.trim().split(/\s+/)[0] ?? '';
}

/**
 * Dashboard personal (MEMBER) — la vista de `GET /dashboard/me` (QL-19, §3.14). Sirve
 * tanto a MEMBER como a ADMIN (el admin también es un usuario con tareas/menciones). El
 * dato del servidor vive en la caché de TanStack Query (`useMyDashboard`); el nombre del
 * saludo sale del perfil en sesión (Zustand, estado de cliente).
 */
export function PersonalDashboard() {
  const user = useAuthStore((s) => s.user);
  const { data, isLoading, isError, error, refetch, isFetching } = useMyDashboard();

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-error/20 bg-error-container/60 px-6 py-12 text-center">
        <AlertCircle className="mb-3 size-8 text-on-error-container" />
        <p className="text-sm font-medium text-on-error-container">
          No se pudo cargar tu panel
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

  const name = firstName(user?.name);
  const { tasks } = data;
  const pendingLine = buildContextLine(tasks.overdue, tasks.today);

  return (
    <div className="space-y-6">
      {/* Saludo + línea de contexto */}
      <header>
        <h1 className="text-3xl font-bold text-on-surface">
          Hola{name ? `, ${name}` : ''}.
        </h1>
        <p className="mt-1 text-sm text-on-surface-variant">{pendingLine}</p>
      </header>

      {/* Rejilla responsive: en móvil se apila; en desktop 3 columnas. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MyTasksCard tasks={tasks} />
        </div>
        {/* (QL-130) Envoltorio a propósito: como celda de la rejilla se estira a lo alto de la
            fila y deja que la tarjeta conserve su altura natural. */}
        <div>
          <FocusProjectCard project={data.focusProject} />
        </div>
        <div className="lg:col-span-2">
          <RecentMentionsCard mentions={data.recentMentions} />
        </div>
        <QuickActions />
      </div>
    </div>
  );
}

/** Frase de contexto bajo el saludo según pendientes de hoy/atrasadas. */
function buildContextLine(overdue: number, today: number): string {
  if (overdue > 0) {
    const plural = overdue === 1 ? 'tarea atrasada' : 'tareas atrasadas';
    return `Tienes ${overdue} ${plural} que requieren atención.`;
  }
  if (today > 0) {
    const plural = today === 1 ? 'tarea vence' : 'tareas vencen';
    return `Tienes ${today} ${plural} hoy.`;
  }
  return 'No tienes pendientes urgentes. Buen momento para avanzar.';
}
