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
  { title: 'Calendario', url: '/calendar', icon: CalendarDays, adminOnly: true },
  { title: 'Analíticas', url: '/analytics', icon: BarChart3, adminOnly: true },
  { title: 'Administración', url: '/admin', icon: Settings, adminOnly: true },
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
