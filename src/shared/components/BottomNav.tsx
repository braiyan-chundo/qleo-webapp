import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { NavIcon } from '@/shared/config/nav';
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
 * Barra de navegación inferior para móvil (QL-22, rediseño QL-42/QL-48). Pastilla
 * **flotante** (con márgenes laterales/inferior) y **opaca** (`bg-surface-container`, sin
 * glass) para que el contenido no se transparente al hacer scroll. Patrón estándar: 4
 * destinos rápidos + un 5º botón "Más" que abre un Sheet con la navegación completa.
 *
 * El slot **activo** eleva el icono dentro de un círculo relleno `bg-primary`
 * (`text-on-primary`) que sobresale del borde superior, con la etiqueta en `text-primary`.
 * Oculta en desktop (`md:hidden`); ahí navega el sidebar.
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
    'group flex flex-1 flex-col items-center justify-end gap-1 py-1 text-xs font-medium';

  // Icono dentro de un círculo: relleno `bg-primary` cuando está activo (elevado y
  // sobresaliendo), o solo contorno cuando está inactivo.
  const renderIcon = (Icon: NavIcon, isActive: boolean) => (
    <span
      className={cn(
        'flex size-10 items-center justify-center rounded-full transition-all duration-200',
        isActive
          ? '-translate-y-2.5 bg-primary text-on-primary shadow-lg shadow-primary/30 dark:glow-primary'
          : 'text-on-surface-variant group-hover:text-on-surface',
      )}
    >
      <Icon className="size-5" aria-hidden />
    </span>
  );

  const renderLabel = (title: string, isActive: boolean) => (
    <span
      className={cn(
        'leading-none transition-colors',
        isActive
          ? '-mt-1 text-primary dark:glow-text'
          : 'text-on-surface-variant group-hover:text-on-surface',
      )}
    >
      {title}
    </span>
  );

  return (
    <nav
      aria-label="Navegación principal"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden"
    >
      <div className="pointer-events-auto flex w-full max-w-md items-stretch justify-around rounded-3xl border border-outline-variant/40 bg-surface-container px-1.5 py-1.5 elevation-3 shadow-xl">
        {bottomNavItems.map((item) => {
          const isActive = isNavItemActive(pathname, item.url);
          return (
            <NavLink
              key={item.title}
              to={item.url}
              aria-current={isActive ? 'page' : undefined}
              className={slotBase}
            >
              {renderIcon(item.icon, isActive)}
              {renderLabel(item.title, isActive)}
            </NavLink>
          );
        })}

        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            className={slotBase}
          >
            {renderIcon(Menu, isMoreActive)}
            {renderLabel('Más', isMoreActive)}
          </button>

          <SheetContent
            side="bottom"
            className="rounded-t-2xl border-t border-outline-variant/40 bg-surface-container pb-[env(safe-area-inset-bottom)]"
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
                        ? 'bg-primary-container text-on-primary-container dark:glow-text'
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
      </div>
    </nav>
  );
}
