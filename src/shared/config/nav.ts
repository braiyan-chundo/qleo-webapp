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
} from 'lucide-react';

/**
 * Configuración de navegación compartida por el shell (QL-21/22/23).
 * Fuente única de rutas/labels/iconos para el sidebar (desktop) y la barra inferior (móvil),
 * evitando "rutas mágicas" duplicadas.
 */
export type NavIcon = typeof LayoutDashboard;

export interface NavItem {
  title: string;
  url: string;
  icon: NavIcon;
  /** Si es true, solo se muestra a usuarios con rol de plataforma `ADMIN`. */
  adminOnly?: boolean;
}

/** Ítems principales del sidebar (desktop). */
export const primaryNavItems: NavItem[] = [
  { title: 'Inicio', url: '/', icon: LayoutDashboard },
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
 */
export const bottomNavItems: NavItem[] = [
  { title: 'Inicio', url: '/', icon: LayoutDashboard },
  { title: 'Proyectos', url: '/projects', icon: Folder },
  { title: 'Mis tareas', url: '/tasks', icon: ClipboardList },
  { title: 'Notificaciones', url: '/notifications', icon: Bell },
];

/**
 * Lista COMPLETA de navegación para el Sheet "Más" (móvil). Reúne los ítems
 * principales y del pie del sidebar en un solo menú; el filtro por rol
 * (`!item.adminOnly || isAdmin`) se aplica en el consumidor, igual que en el sidebar.
 */
export const allNavItems: NavItem[] = [...primaryNavItems, ...footerNavItems];

/**
 * Determina si un ítem de navegación está activo para el `pathname` actual (QL-24).
 *
 * La coincidencia exacta (`pathname === url`) no ilumina la sección al entrar en rutas
 * hijas (p. ej. `/projects/:id`). Aquí:
 * - `url === '/'` (Inicio): solo activo en la raíz exacta; de otro modo `startsWith('/')`
 *   casaría con TODAS las rutas.
 * - resto: activo por coincidencia exacta o por prefijo de sección (`url + '/'`), evitando
 *   falsos positivos como `/projects-archive` para `/projects`.
 */
export function isNavItemActive(pathname: string, url: string): boolean {
  if (url === '/') return pathname === '/';
  return pathname === url || pathname.startsWith(url + '/');
}
