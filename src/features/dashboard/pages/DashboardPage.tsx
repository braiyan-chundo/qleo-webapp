import { useAuthStore } from '@/store/auth.store';

import { AdminDashboard } from '../components/AdminDashboard';
import { PersonalDashboard } from '../components/PersonalDashboard';
import { RecentProjectsCard } from '../components/RecentProjectsCard';

/**
 * Vista inicial tras login (`/`): el **panel role-aware** (QL-20). ADMIN ve el resumen de la
 * plataforma (`AdminDashboard`); el resto, su panel personal (`PersonalDashboard`).
 *
 * QL-95 (D-K1) devolvió `/` al panel sin pestañas: el Muro Corporativo vive ahora en su propia
 * ruta (`/muro`, `WallPage`), no como pestaña del dashboard.
 *
 * "Proyectos recientes" (QL-123): el cliente lo quiere justo **encima de la gráfica "Tareas
 * cerradas por semana"**, que solo existe en el panel del ADMIN. Por eso la tarjeta se monta
 * dentro de `AdminDashboard` para ese rol, y aquí —a todo lo ancho, como hasta ahora— para el
 * MEMBER, cuyo panel no tiene gráficas. Las ramas son **excluyentes**: cada usuario la ve una
 * sola vez, y ningún rol se queda sin ella.
 */
export function DashboardPage() {
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');

  return (
    <div className="space-y-6 p-4 md:p-8">
      {isAdmin ? (
        <AdminDashboard />
      ) : (
        <>
          <PersonalDashboard />
          <RecentProjectsCard />
        </>
      )}
    </div>
  );
}
