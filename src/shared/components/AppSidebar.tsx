import { NavLink, useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { QleoMark } from '@/shared/components/QleoLogo';
import { useAuthStore } from '@/store/auth.store';
import {
  primaryNavItems,
  footerNavItems,
  isNavItemActive,
} from '@/shared/config/nav';
import { getDailySlogan } from '@/shared/config/slogans';

/**
 * Clases base del `NavLink` interno de cada ítem del sidebar.
 *
 * En modo expandido: fila con icono + label y (si activo) barra lateral derecha.
 * En modo icono (`group-data-[collapsible=icon]`): el primitivo fuerza `size-8! p-2!`
 * sobre el botón, así que centramos el contenido, quitamos márgenes/paddings residuales
 * y sustituimos la barra lateral por un fondo redondeado legible.
 */
const navLinkBase = cn(
  'flex w-full items-center gap-3 rounded-lg transition-colors',
  'group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0',
);

/**
 * Clases del estado activo (expandido: barra lateral · icono: fondo redondeado).
 *
 * QL-39: el fondo del sidebar pasa a `surface-container`; el activo usa un token más alto
 * (`surface-container-highest`) para seguir destacando en claro y oscuro sin confundirse
 * con el fondo del carril.
 */
const navLinkActive = cn(
  'text-primary dark:glow-text font-bold',
  'bg-surface-container-highest border-r-4 border-primary',
  'hover:bg-surface-container-highest hover:text-primary',
  'group-data-[collapsible=icon]:border-r-0 group-data-[collapsible=icon]:rounded-lg',
  'group-data-[collapsible=icon]:bg-primary-container group-data-[collapsible=icon]:text-primary',
);

const navLinkInactive =
  'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface';

export function AppSidebar() {
  const { pathname } = useLocation();
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');

  const visibleNavItems = primaryNavItems.filter(
    (item) => !item.adminOnly || isAdmin,
  );
  const visibleFooterItems = footerNavItems.filter(
    (item) => !item.adminOnly || isAdmin,
  );

  return (
    <Sidebar
      collapsible="icon"
      // QL-39: el fondo diferenciado (claro y oscuro) lo aporta el token `--sidebar`
      // (ver index.css); el primitivo lo pinta con `bg-sidebar` en su capa interna, así que
      // aquí no forzamos un bg que quedaría tapado.
      className="glass border-r border-outline-variant/40"
    >
      <SidebarHeader className="py-4 px-6 flex-row items-center gap-3 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:justify-center">
        <div className="w-10 h-10 shrink-0 rounded-lg bg-primary-container text-on-primary-container dark:text-primary dark:glow-text flex items-center justify-center">
          <QleoMark size={26} label="Qleo" />
        </div>
        <div className="flex flex-col group-data-[collapsible=icon]:hidden">
          <span className="font-heading font-bold text-primary dark:text-inverse-primary dark:glow-text text-xl leading-tight tracking-tight">Qleo</span>
          <span className="text-xs font-medium text-on-surface-variant">{getDailySlogan()}</span>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 pt-4 group-data-[collapsible=icon]:px-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {visibleNavItems.map((item) => {
                const isActive = isNavItemActive(pathname, item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      tooltip={item.title}
                      isActive={isActive}
                      asChild
                    >
                      <NavLink
                        to={item.url}
                        className={cn(
                          navLinkBase,
                          isActive ? navLinkActive : navLinkInactive,
                        )}
                      >
                        <item.icon className="w-5 h-5 shrink-0" />
                        <span className="text-sm group-data-[collapsible=icon]:hidden">
                          {item.title}
                        </span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-3 pb-6 border-t border-outline-variant/30 pt-4 group-data-[collapsible=icon]:px-2">
        <SidebarMenu className="gap-1">
          {visibleFooterItems.map((item) => {
            const isActive = isNavItemActive(pathname, item.url);
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton tooltip={item.title} isActive={isActive} asChild>
                  <NavLink
                    to={item.url}
                    className={cn(
                      navLinkBase,
                      isActive ? navLinkActive : navLinkInactive,
                    )}
                  >
                    <item.icon className="w-5 h-5 shrink-0" />
                    <span className="text-sm group-data-[collapsible=icon]:hidden">
                      {item.title}
                    </span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
