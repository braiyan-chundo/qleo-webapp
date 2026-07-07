import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useAuthStore } from '@/store/auth.store';
import {
  bottomNavItems,
  allNavItems,
  isNavItemActive,
} from '@/shared/config/nav';

/**
 * Barra de navegación inferior para móvil (QL-22). Patrón estándar: 4 destinos rápidos
 * (Dashboard, Projects, My Tasks, Notifications) + un 5º botón "Más" que abre un Sheet
 * inferior con la lista COMPLETA de navegación filtrada por rol. Fija abajo, full-width,
 * borde superior y safe-area. Oculta en desktop (`md:hidden`); ahí navega el sidebar.
 */
export function BottomNav() {
  const { pathname } = useLocation();
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const [moreOpen, setMoreOpen] = useState(false);

  const menuItems = allNavItems.filter((item) => !item.adminOnly || isAdmin);

  // "Más" se marca activo cuando NINGÚN slot rápido está activo (incl. rutas hijas).
  const isMoreActive = !bottomNavItems.some((i) =>
    isNavItemActive(pathname, i.url),
  );

  const slotBase =
    'flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-medium transition-colors';

  return (
    <nav
      aria-label="Navegación principal"
      className="glass fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-outline-variant/40 bg-surface elevation-2 pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {bottomNavItems.map((item) => {
        const isActive = isNavItemActive(pathname, item.url);
        return (
          <NavLink
            key={item.title}
            to={item.url}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              slotBase,
              isActive
                ? 'text-primary dark:glow-text'
                : 'text-on-surface-variant hover:text-on-surface',
            )}
          >
            <item.icon className="size-5" aria-hidden />
            <span className="leading-none">{item.title}</span>
          </NavLink>
        );
      })}

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          className={cn(
            slotBase,
            isMoreActive
              ? 'text-primary dark:glow-text'
              : 'text-on-surface-variant hover:text-on-surface',
          )}
        >
          <Menu className="size-5" aria-hidden />
          <span className="leading-none">Más</span>
        </button>

        <SheetContent
          side="bottom"
          className="glass rounded-t-2xl border-t border-outline-variant/40 bg-surface pb-[env(safe-area-inset-bottom)]"
        >
          <SheetHeader>
            <SheetTitle className="text-on-surface">Navegación</SheetTitle>
          </SheetHeader>
          <nav
            aria-label="Todas las secciones"
            className="grid grid-cols-1 gap-1 px-4 pb-4"
          >
            {menuItems.map((item) => {
              const isActive = isNavItemActive(pathname, item.url);
              return (
                <NavLink
                  key={item.title}
                  to={item.url}
                  onClick={() => setMoreOpen(false)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary-container text-primary dark:glow-text'
                      : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface',
                  )}
                >
                  <item.icon className="size-5 shrink-0" aria-hidden />
                  <span className="leading-none">{item.title}</span>
                </NavLink>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
