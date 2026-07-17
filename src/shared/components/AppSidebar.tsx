import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
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
  SidebarMenuAction,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from '@/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { QleoMark } from '@/shared/components/QleoLogo';
import { BetaBadge } from '@/shared/components/BetaBadge';
import { NavBadge } from '@/shared/components/NavBadge';
import { useAuthStore } from '@/store/auth.store';
import { useWallUnreadCount } from '@/features/wall/hooks/use-wall';
import { useProjects } from '@/features/projects/hooks/use-projects';
import type { ProjectListParams } from '@/features/projects/services/projects.service';
import { projectDot } from '@/features/tasks/lib/palette';
import {
  primaryNavItems,
  footerNavItems,
  isNavItemActive,
  activeNavUrl,
  type NavItem,
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
  // Colapsado: pastilla `primary-container`. En CLARO el icono/indicador activo usa
  // `on-primary-container` (casi blanco) sobre el azul del contenedor para que se lea; en
  // OSCURO se re-afirma `text-primary` (aspecto neón intacto — el modo oscuro NO cambia).
  'group-data-[collapsible=icon]:bg-primary-container group-data-[collapsible=icon]:text-on-primary-container dark:group-data-[collapsible=icon]:text-primary',
);

const navLinkInactive =
  'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface';

/**
 * Clases de un sub-ítem (proyecto) del submenú.
 *
 * El primitivo trae su propio par `hover:bg-sidebar-accent` / `data-active:bg-sidebar-accent`;
 * aquí se re-declaran **con los mismos variantes** en tokens M3 para que `cn` (tailwind-merge)
 * deje ganar a estos y el activo del sub-ítem hable el mismo idioma visual que el del padre.
 */
const subLinkClasses = cn(
  'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
  'data-active:bg-surface-container-highest data-active:font-semibold data-active:text-primary',
);

/** Ítem del nav que despliega el submenú de proyectos. */
const PROJECTS_URL = '/projects';

/** Proyectos del usuario listados como sub-ítems (activos; el resto, tras "Ver todos"). */
const PROJECTS_NAV_PARAMS: ProjectListParams = { archived: false, limit: 10 };

/**
 * Id del proyecto de la ruta actual, o `null` si no estamos dentro de uno. Cubre las rutas
 * hijas (`/projects/:id/tasks/:taskId`) para que el sub-ítem siga marcado dentro de una tarea.
 */
function activeProjectId(pathname: string): string | null {
  const match = /^\/projects\/([^/]+)/.exec(pathname);
  return match ? match[1] : null;
}

export function AppSidebar() {
  const { pathname } = useLocation();
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const { count: wallUnread } = useWallUnreadCount();

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
          <div className="flex items-center gap-2">
            <span className="font-heading font-bold text-primary dark:text-inverse-primary dark:glow-text text-xl leading-tight tracking-tight">Qleo</span>
            <BetaBadge size="xs" />
          </div>
          <span className="text-xs font-medium text-on-surface-variant">{getDailySlogan()}</span>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 pt-4 group-data-[collapsible=icon]:px-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {visibleNavItems.map((item) => {
                const isActive = isNavItemActive(pathname, item.url);
                const badgeCount = item.badge === 'wall' ? wallUnread : 0;

                // Grupo con sub-ítems estáticos (QL-149, p. ej. "Administración"): se despliega
                // en sus hijos con el mismo patrón visual que Proyectos.
                if (item.children) {
                  return (
                    <NavGroupItem
                      key={item.title}
                      item={item}
                      pathname={pathname}
                    />
                  );
                }

                // "Proyectos" es el único ítem con submenú: sigue navegando a `/projects` y
                // despliega los proyectos del usuario desde su propio chevron.
                if (item.url === PROJECTS_URL) {
                  return (
                    <ProjectsNavItem
                      key={item.title}
                      item={item}
                      isActive={isActive}
                      pathname={pathname}
                    />
                  );
                }

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
                        <NavItemContent item={item} badgeCount={badgeCount} />
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

interface NavItemContentProps {
  item: NavItem;
  badgeCount: number;
}

/**
 * Interior de un ítem del nav (icono + badge + label). Se extrae como **fragmento**, no como
 * componente envolvente, para que el `NavLink` siga siendo el hijo directo de
 * `SidebarMenuButton asChild` (el Slot clona ese hijo y le pasa sus props/estado).
 */
function NavItemContent({ item, badgeCount }: NavItemContentProps) {
  return (
    <>
      <span className="relative shrink-0">
        <item.icon className="w-5 h-5" />
        {item.badge && (
          <NavBadge
            count={badgeCount}
            label={`${item.title}, ${badgeCount} sin leer`}
          />
        )}
      </span>
      <span className="text-sm group-data-[collapsible=icon]:hidden">
        {item.title}
      </span>
    </>
  );
}

interface NavGroupItemProps {
  item: NavItem;
  pathname: string;
}

/**
 * Ítem de navegación **agrupador** con sub-ítems estáticos (QL-149, p. ej. "Administración").
 *
 * Sigue el mismo patrón visual que `ProjectsNavItem` pero con hijos fijos de la config (no dato
 * de servidor): el label/icono del padre es un link a su `url` (por defecto la del primer hijo)
 * y el chevron despliega el submenú. Se auto-expande cuando la ruta actual cae en un hijo y marca
 * el hijo correcto resolviendo el solapamiento de prefijos con `activeNavUrl` (el más específico).
 */
function NavGroupItem({ item, pathname }: NavGroupItemProps) {
  const children = item.children ?? [];
  const activeChildUrl = activeNavUrl(pathname, children);
  const isActive = activeChildUrl !== null;
  const [open, setOpen] = useState(() => isActive);

  // Auto-expandir al entrar en una sub-sección; no se cierra al salir (respeta el toggle manual).
  useEffect(() => {
    if (isActive) setOpen(true);
  }, [isActive]);

  return (
    <Collapsible asChild open={open} onOpenChange={setOpen}>
      <SidebarMenuItem>
        <SidebarMenuButton tooltip={item.title} isActive={isActive} asChild>
          <NavLink
            to={item.url}
            className={cn(navLinkBase, isActive ? navLinkActive : navLinkInactive)}
          >
            <NavItemContent item={item} badgeCount={0} />
          </NavLink>
        </SidebarMenuButton>

        <CollapsibleTrigger asChild>
          <SidebarMenuAction
            className={cn(
              'top-2.5 text-on-surface-variant',
              'hover:bg-surface-container-high hover:text-on-surface',
              'transition-transform data-[state=open]:rotate-90',
            )}
          >
            <ChevronRight />
            <span className="sr-only">Mostrar sub-secciones de {item.title}</span>
          </SidebarMenuAction>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <SidebarMenuSub className="mt-1 border-outline-variant/50">
            {children.map((child) => (
              <SidebarMenuSubItem key={child.url + child.title}>
                <SidebarMenuSubButton
                  asChild
                  isActive={activeChildUrl === child.url}
                  className={subLinkClasses}
                >
                  <NavLink to={child.url} title={child.title}>
                    <child.icon className="size-4 shrink-0" />
                    <span>{child.title}</span>
                  </NavLink>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

interface ProjectsNavItemProps {
  item: NavItem;
  isActive: boolean;
  pathname: string;
}

/**
 * Ítem "Proyectos" con **sub-ítems** de los proyectos del usuario (estilo Jira).
 *
 * El label/icono **sigue siendo un link** a `/projects` (no un toggle): el despliegue va por una
 * acción aparte (chevron), como en el patrón de shadcn. Se auto-expande al entrar en un proyecto
 * y marca su sub-ítem (también en rutas hijas de tarea). En modo icono el primitivo oculta acción
 * y submenú (`group-data-[collapsible=icon]:hidden`); no forzamos nada por encima.
 *
 * Los proyectos son dato de servidor → TanStack Query (`useProjects`); la caché los comparte con
 * la página de Proyectos, así que el submenú no añade tráfico extra al navegar.
 */
function ProjectsNavItem({ item, isActive, pathname }: ProjectsNavItemProps) {
  const currentProjectId = activeProjectId(pathname);
  const [open, setOpen] = useState(() => currentProjectId !== null);

  // Auto-expandir al entrar en un proyecto. No lo cerramos al salir: si el usuario lo abrió,
  // se queda abierto.
  useEffect(() => {
    if (currentProjectId) setOpen(true);
  }, [currentProjectId]);

  const { data, isLoading } = useProjects(PROJECTS_NAV_PARAMS);
  const projects = data?.data ?? [];
  const hasMore = (data?.total ?? 0) > projects.length;

  // Sin proyectos (ya cargado) no pintamos chevron ni submenú: cero ruido.
  const hasSubmenu = isLoading || projects.length > 0;

  return (
    <Collapsible asChild open={open} onOpenChange={setOpen}>
      <SidebarMenuItem>
        <SidebarMenuButton tooltip={item.title} isActive={isActive} asChild>
          <NavLink
            to={item.url}
            className={cn(navLinkBase, isActive ? navLinkActive : navLinkInactive)}
          >
            <NavItemContent item={item} badgeCount={0} />
          </NavLink>
        </SidebarMenuButton>

        {hasSubmenu && (
          <>
            <CollapsibleTrigger asChild>
              <SidebarMenuAction
                className={cn(
                  'top-2.5 text-on-surface-variant',
                  'hover:bg-surface-container-high hover:text-on-surface',
                  'transition-transform data-[state=open]:rotate-90',
                )}
              >
                <ChevronRight />
                <span className="sr-only">Mostrar mis proyectos</span>
              </SidebarMenuAction>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <SidebarMenuSub className="mt-1 border-outline-variant/50">
                {isLoading ? (
                  <>
                    <SidebarMenuSubItem className="flex h-7 items-center px-2">
                      <Skeleton className="h-3 w-24" />
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem className="flex h-7 items-center px-2">
                      <Skeleton className="h-3 w-16" />
                    </SidebarMenuSubItem>
                  </>
                ) : (
                  <>
                    {projects.map((project) => (
                      <SidebarMenuSubItem key={project.id}>
                        <SidebarMenuSubButton
                          asChild
                          isActive={currentProjectId === project.id}
                          className={subLinkClasses}
                        >
                          <NavLink to={`/projects/${project.id}`} title={project.name}>
                            <span
                              aria-hidden
                              className={cn(
                                'size-2 shrink-0 rounded-full',
                                projectDot(project.color) ?? 'bg-outline-variant',
                              )}
                            />
                            <span>{project.name}</span>
                          </NavLink>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}

                    {hasMore && (
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          asChild
                          size="sm"
                          className="font-medium text-primary hover:bg-surface-container-high hover:text-primary"
                        >
                          <NavLink to={PROJECTS_URL}>
                            <span>Ver todos</span>
                          </NavLink>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    )}
                  </>
                )}
              </SidebarMenuSub>
            </CollapsibleContent>
          </>
        )}
      </SidebarMenuItem>
    </Collapsible>
  );
}
