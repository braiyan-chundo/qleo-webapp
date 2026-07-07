import { useAuthStore } from '@/store/auth.store';

import { AdminDashboard } from '../components/AdminDashboard';
import { PersonalDashboard } from '../components/PersonalDashboard';

/**
 * Vista inicial tras login (`/`). Ramifica por **rol de plataforma** (QL-20):
 * - **ADMIN** → resumen de sistema (`GET /dashboard/admin`), su landing.
 * - **MEMBER** → dashboard personal (`GET /dashboard/me`, QL-19).
 */
export function DashboardPage() {
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');

  return (
    <div className="p-4 md:p-8">
      {isAdmin ? <AdminDashboard /> : <PersonalDashboard />}
    </div>
  );
}
