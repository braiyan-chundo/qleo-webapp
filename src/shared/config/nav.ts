import {
  LayoutDashboard,
  Folder,
  ClipboardList,
  Bell,
  Settings,
  History,
  HelpCircle,
  CalendarDays,
  UserCircle,
  BarChart3,
  Megaphone,
  Users,
  SlidersHorizontal,
} from 'lucide-react';

/**
 * Configuración de navegación compartida por el shell (QL-21/22/23).
 * Fuente única de rutas/labels/iconos para el sidebar (desktop) y la barra inferior (móvil),
 * evitando "rutas mágicas" duplicadas.
 */
export type NavIcon = typeof LayoutDashboard;

/**
 * Marcador de badge dinámico de un ítem. El conteo lo resuelve el consumidor (sidebar /
 * bottom nav) con su hook — la config no puede llamar hooks. Hoy solo `wall` (no leídos
 * del Muro Corporativo, QL-91).
 */
export type NavBadgeKind = 'wall';

export interface NavItem {
  title: string;
  url: string;
  icon: NavIcon;
  /** Si es true, solo se muestra a usuarios con rol de plataforma `ADMIN`. */
  adminOnly?: boolean;
  /** Si está, el consumidor pinta un badge numérico junto al ítem (QL-91). */
  badge?: NavBadgeKind;
  /**
   * Sub-ítems estáticos de un grupo expandible (QL-149). Cuando está presente, el consumidor
   * (sidebar / bottom nav) pinta el ítem como grupo con hijos en vez de un link plano. El `url`
   * del padre sigue siendo un destino válido (por defecto, el del primer hijo).
   */
  children?: NavItem[];
}

/**
 * Ítems principales del sidebar (desktop).
 *
 * **Inicio** → `/` (dashboard/panel role-aware) y **Muro** → `/muro` (Muro Corporativo, con
 * badge de no leídos). QL-95 (D-K1) separó el Muro a su **ruta propia** y deshizo las pestañas
 * `?tab=` del dashboard, así que cada ítem se ilumina por su `pathname` (ver `isNavItemActive`).
 */
export const primaryNavItems: NavItem[] = [
  { title: 'Inicio', url: '/', icon: LayoutDashboard },
  { title: 'Muro', url: '/muro', icon: Megaphone, badge: 'wall' },
  { title: 'Proyectos', url: '/projects', icon: Folder },
  { title: 'Mis tareas', url: '/tasks', icon: ClipboardList },
  { title: 'Notificaciones', url: '/notifications', icon: Bell },
  {
    // Calendario = **una sola ruta** `/calendar` (link plano para todos). Revierte la variante
    // QL-165 (grupo expandible con sub-rutas `/calendar/festivos|turnos|mallas`): las secciones del
    // ADMIN (Calendario · Festivos · Turnos · Mallas) viven ahora como **tabs dentro de la página**
    // (`?tab=`), no como subítems del sidebar. El MEMBER ve el mismo link → su calendario de solo
    // lectura. El resaltado casa por `pathname` ('/calendar') y sobrevive al cambio de `?tab=`.
    title: 'Calendario',
    url: '/calendar',
    icon: CalendarDays,
  },
  { title: 'Analíticas', url: '/analytics', icon: BarChart3, adminOnly: true },
  {
    // QL-149: "Administración" pasa a ser un grupo expandible. El padre navega a `/admin`
    // (= Usuarios, la vista de siempre) y despliega sus sub-secciones.
    title: 'Administración',
    url: '/admin',
    icon: Settings,
    adminOnly: true,
    children: [
      { title: 'Usuarios', url: '/admin', icon: Users, adminOnly: true },
      {
        title: 'Configuración',
        url: '/admin/configuracion',
        icon: SlidersHorizontal,
        adminOnly: true,
      },
    ],
  },
];

/** Ítems del pie del sidebar (desktop). */
export const footerNavItems: NavItem[] = [
  { title: 'Auditoría', url: '/audit', icon: History, adminOnly: true },
  { title: 'Mi cuenta', url: '/profile', icon: UserCircle },
  { title: 'Ayuda', url: '/help', icon: HelpCircle },
];

/**
 * Los 4 destinos rápidos de la barra inferior móvil (QL-22). Labels/iconos alineados
 * con el sidebar para consistencia. El 5º slot ("Más") lo renderiza `BottomNav` como
 * disparador de un Sheet con la lista completa; no vive aquí porque no es una ruta.
 *
 * QL-107: el bottom nav es **Inicio · Proyectos · Mis tareas · Muro**. Se sacó
 * **Notificaciones** porque ya está en el **top nav** (`NotificationBell` de `AppLayout`) y se
 * dio su slot rápido al **Muro** (con badge de no leídos, `badge: 'wall'`). Notificaciones sigue
 * accesible desde la campana del top nav y desde el menú **"Más"** del bottom nav (`allNavItems`).
 */
export const bottomNavItems: NavItem[] = [
  { title: 'Inicio', url: '/', icon: LayoutDashboard },
  { title: 'Proyectos', url: '/projects', icon: Folder },
  { title: 'Mis tareas', url: '/tasks', icon: ClipboardList },
  { title: 'Muro', url: '/muro', icon: Megaphone, badge: 'wall' },
];

/**
 * Lista COMPLETA de navegación para el Sheet "Más" (móvil). Reúne los ítems
 * principales y del pie del sidebar en un solo menú; el filtro por rol
 * (`!item.adminOnly || isAdmin`) se aplica en el consumidor, igual que en el sidebar.
 */
export const allNavItems: NavItem[] = [...primaryNavItems, ...footerNavItems];

/**
 * Determina si un ítem de navegación está activo para la ubicación actual (QL-24).
 *
 * La coincidencia exacta (`pathname === url`) no ilumina la sección al entrar en rutas
 * hijas (p. ej. `/projects/:id`). Aquí:
 * - `url === '/'` (Inicio): solo activo en la raíz exacta, para no iluminarse en cada ruta.
 * - resto: activo por coincidencia exacta o por prefijo de sección (`url + '/'`), evitando
 *   falsos positivos como `/projects-archive` para `/projects`.
 *
 * QL-95 devolvió el Muro a su ruta propia (`/muro`), así que ya no hace falta desempatar por
 * `?tab=`: basta el `pathname`.
 */
export function isNavItemActive(pathname: string, url: string): boolean {
  if (url === '/') return pathname === '/';
  return pathname === url || pathname.startsWith(url + '/');
}

/**
 * Devuelve el `url` del ítem que **mejor** casa con `pathname` entre los candidatos, o `null`
 * si ninguno casa (QL-149).
 *
 * Resuelve el solapamiento de prefijos entre hermanos: p. ej. `/admin` (Usuarios) es prefijo de
 * `/admin/configuracion`, así que en esa ruta ambos "casan" por `isNavItemActive`; gana el de
 * `url` más largo (el más específico). Así solo un hijo se ilumina a la vez.
 */
export function activeNavUrl(
  pathname: string,
  items: readonly { url: string }[],
): string | null {
  let best: string | null = null;
  for (const item of items) {
    if (isNavItemActive(pathname, item.url)) {
      if (best === null || item.url.length > best.length) best = item.url;
    }
  }
  return best;
}

/**
 * Aplana una lista de navegación expandiendo los grupos (`children`) en sus hojas (QL-149),
 * **consciente del rol** (QL-165). Lo usa el menú "Más" del bottom nav, que es una lista plana.
 *
 * Por cada grupo se filtran los hijos por rol (`!adminOnly || isAdmin`):
 * - si quedan hijos visibles → se devuelven esos (el parent-contenedor se descarta, su `url` ya
 *   la cubre un hijo);
 * - si NO queda ninguno (un grupo cuyos hijos son todos `adminOnly`, visto por un MEMBER) → se
 *   devuelve el **parent** como link plano, para no perder la sección del menú.
 *
 * Los ítems sin hijos se mantienen tal cual. El filtro por `adminOnly` de los ítems de primer
 * nivel (p. ej. el parent `adminOnly` de "Administración") lo sigue aplicando el consumidor.
 */
export function flattenNavItems(items: NavItem[], isAdmin: boolean): NavItem[] {
  return items.flatMap((item) => {
    if (!item.children) return [item];
    const visibleChildren = item.children.filter(
      (child) => !child.adminOnly || isAdmin,
    );
    return visibleChildren.length > 0 ? visibleChildren : [item];
  });
}
