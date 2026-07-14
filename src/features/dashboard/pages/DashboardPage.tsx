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
 * "Proyectos recientes" se monta **aquí** (y no dentro de cada panel) porque es útil a los dos
 * roles y sus rejillas son distintas: como sección propia a todo lo ancho no altera ninguna de
 * las dos y en móvil se apila igual que el resto.
 */
export function DashboardPage() {
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');

  return (
    <div className="space-y-6 p-4 md:p-8">
      {isAdmin ? <AdminDashboard /> : <PersonalDashboard />}
      <RecentProjectsCard />
    </div>
  );
}
