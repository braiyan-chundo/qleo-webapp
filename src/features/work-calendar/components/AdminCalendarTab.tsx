import { useMemo, useState } from 'react';

import { useAuthStore } from '@/store/auth.store';
import { UserSelect, type SelectedUser } from '@/features/users/components/UserSelect';

import { MemberCalendarView } from './MemberCalendarView';

/**
 * Tab **Calendario** del Calendario ADMIN (QL-163). Reutiliza `MemberCalendarView` (calendario
 * mensual de solo lectura con turnos, festivos y no-laborables) añadiendo un **selector de
 * usuario**: el ADMIN elige de quién ve el calendario. Por defecto, el suyo propio.
 */
export function AdminCalendarTab() {
  const currentUser = useAuthStore((s) => s.user);

  const selfAsUser = useMemo<SelectedUser | null>(
    () =>
      currentUser
        ? {
            id: currentUser.id,
            name: currentUser.name,
            email: currentUser.email,
            avatarUrl: currentUser.avatarUrl,
            avatarDownloadUrl: currentUser.avatarDownloadUrl,
          }
        : null,
    [currentUser],
  );

  const [selected, setSelected] = useState<SelectedUser | null>(selfAsUser);

  const isSelf = !!currentUser && selected?.id === currentUser.id;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1.5">
          <span className="text-sm font-medium text-on-surface">Usuario</span>
          <UserSelect
            value={selected}
            onChange={setSelected}
            className="w-64"
            placeholder="Elegir usuario…"
          />
        </div>
        <p className="text-sm text-on-surface-variant">
          {isSelf ? 'Estás viendo tu propio calendario.' : `Calendario de ${selected?.name ?? '—'}`}
        </p>
      </div>

      {selected && <MemberCalendarView userId={selected.id} ownCalendar={isSelf} />}
    </div>
  );
}
