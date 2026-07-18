import { CalendarDays } from 'lucide-react';

import { useAuthStore } from '@/store/auth.store';
import { BackButton } from '@/shared/components/BackButton';

import { AdminCalendarPage } from './AdminCalendarPage';
import { MemberCalendarView } from '../components/MemberCalendarView';

/**
 * (QL-162/QL-163) Punto de entrada de `/calendar`, accesible a **cualquier autenticado**.
 *
 * - **ADMIN** → el Calendario ADMIN con tabs (`AdminCalendarPage`): Calendario (de cualquier
 *   usuario) · Festivos · Turnos · Mallas.
 * - **MEMBER** → su calendario personal de **solo lectura** (turnos de su malla, festivos, días
 *   no laborables), sin acciones de edición.
 */
export function CalendarPage() {
  const user = useAuthStore((s) => s.user);

  if (user?.role === 'ADMIN') {
    return <AdminCalendarPage />;
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <BackButton fallback={{ to: '/', label: 'Inicio' }} />
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-full bg-primary-container text-primary">
              <CalendarDays className="size-5" />
            </span>
            <h1 className="text-3xl font-bold text-on-surface">Mi calendario</h1>
          </div>
        </div>
        <p className="mt-1 text-sm text-on-surface-variant">
          Consulta tus turnos por día según tu malla horaria, los festivos y los días no
          laborables. Solo lectura: la configuración la gestiona un administrador.
        </p>
      </div>

      {user && <MemberCalendarView userId={user.id} />}
    </div>
  );
}
