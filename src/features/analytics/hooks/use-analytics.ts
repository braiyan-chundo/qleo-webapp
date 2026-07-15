import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/store/auth.store';
import { analyticsService } from '../services/analytics.service';

/**
 * Hooks de datos de la analítica (QL-66, §3.24). Toda la lectura del servidor pasa por
 * TanStack Query; los componentes no llaman al service ni manejan loading/error a mano.
 */

/** Frescura de las métricas (agregaciones no cambian a cada segundo). */
const STALE_TIME = 30_000;

export const analyticsKeys = {
  all: ['analytics'] as const,
  overview: () => [...analyticsKeys.all, 'overview'] as const,
  project: (id: string) => [...analyticsKeys.all, 'project', id] as const,
  task: (id: string) => [...analyticsKeys.all, 'task', id] as const,
  users: () => [...analyticsKeys.all, 'users'] as const,
};

/**
 * Métricas globales (`GET /analytics/overview`). Solo corre si hay sesión **y** el usuario
 * es ADMIN (el backend igual lo protege con 403; evitamos la llamada para un MEMBER).
 */
export function useAnalyticsOverview() {
  const token = useAuthStore((s) => s.accessToken);
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');

  return useQuery({
    queryKey: analyticsKeys.overview(),
    queryFn: () => analyticsService.getOverview(),
    enabled: !!token && isAdmin,
    staleTime: STALE_TIME,
  });
}

/**
 * Métricas de un proyecto (`GET /analytics/projects/:id`). Solo corre con `projectId`. El
 * backend autoriza a ADMIN o al creador; si no, responde 403 (se refleja como `isError`).
 */
export function useProjectAnalytics(projectId: string | undefined) {
  const token = useAuthStore((s) => s.accessToken);

  return useQuery({
    queryKey: analyticsKeys.project(projectId ?? ''),
    queryFn: () => analyticsService.getProject(projectId as string),
    enabled: !!token && !!projectId,
    staleTime: STALE_TIME,
  });
}

/**
 * Análisis de una tarea (`GET /analytics/tasks/:id`, §3.24 P5). **Solo ADMIN** (el backend es
 * estricto: ni el creador). Solo corre con sesión ADMIN **y** `taskId`, para no llamar (403)
 * a un MEMBER.
 */
export function useTaskAnalytics(taskId: string | undefined) {
  const token = useAuthStore((s) => s.accessToken);
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');

  return useQuery({
    queryKey: analyticsKeys.task(taskId ?? ''),
    queryFn: () => analyticsService.getTaskAnalytics(taskId as string),
    enabled: !!token && isAdmin && !!taskId,
    staleTime: STALE_TIME,
  });
}

/**
 * Rendimiento por usuario (`GET /analytics/users`, §3.24 P6). **Solo ADMIN**; ya viene ordenado
 * por eficiencia desc. Solo corre con sesión ADMIN (evita la llamada 403 para un MEMBER).
 */
export function useUsersPerformance() {
  const token = useAuthStore((s) => s.accessToken);
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');

  return useQuery({
    queryKey: analyticsKeys.users(),
    queryFn: () => analyticsService.getUsersPerformance(),
    enabled: !!token && isAdmin,
    staleTime: STALE_TIME,
  });
}
