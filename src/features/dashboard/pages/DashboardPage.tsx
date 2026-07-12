import { useAuthStore } from '@/store/auth.store';

import { AdminDashboard } from '../components/AdminDashboard';
import { PersonalDashboard } from '../components/PersonalDashboard';

/**
 * Vista inicial tras login (`/`): el **panel role-aware** (QL-20). ADMIN ve el resumen de la
 * plataforma (`AdminDashboard`); el resto, su panel personal (`PersonalDashboard`).
 *
 * QL-95 (D-K1) devolvió `/` al panel sin pestañas: el Muro Corporativo vive ahora en su propia
 * ruta (`/muro`, `WallPage`), no como pestaña del dashboard.
 */
export function DashboardPage() {
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');

  return (
    <div className="p-4 md:p-8">
      {isAdmin ? <AdminDashboard /> : <PersonalDashboard />}
    </div>
  );
}
