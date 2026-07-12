import { Skeleton } from '@/components/ui/skeleton';

/** Placeholder de carga del dashboard personal: refleja el layout real (§3.14). */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56 rounded-md" />
        <Skeleton className="h-4 w-72 rounded-md" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Skeleton className="h-64 rounded-xl lg:col-span-2" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </div>
  );
}

/**
 * Placeholder de carga del panel ADMIN (QL-112): refleja el nuevo layout con KPIs,
 * cuadrícula de gráficas y la actividad reciente enriquecida.
 */
export function AdminDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56 rounded-md" />
        <Skeleton className="h-4 w-72 rounded-md" />
      </div>
      {/* KPIs (3 en fila, QL-55) */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        <Skeleton className="h-24 rounded-xl sm:h-32" />
        <Skeleton className="h-24 rounded-xl sm:h-32" />
        <Skeleton className="h-24 rounded-xl sm:h-32" />
      </div>
      {/* Gráficas */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
      {/* Actividad + Roles */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}
