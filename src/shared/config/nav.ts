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
  Sparkles,
} from 'lucide-react';

import type { PlatformPermission } from '@/shared/lib/permissions';

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
  /**
   * (QL-190) Si es true, solo se muestra a quien puede usar la IA (`canUseAi()`: ADMIN o MEMBER no
   * revocado). El consumidor aplica el gate; ocultarlo es cosmético — la seguridad la impone el
   * `AiAccessGuard` del backend.
   */
  requiresAi?: boolean;
  /**
   * (QL-198b, §3.70 §9) Permiso de plataforma que **ABRE** el ítem a quien no llega por rol. Se
   * suma a `adminOnly`, no lo sustituye: con `adminOnly: true` + `requiresPermission`, el ítem lo
   * ven ADMIN/Dirección **o** quien tenga ese permiso delegado en su perfil.
   *
   * Existe porque un permiso delegable cuya pantalla vive tras un gate de rol sería un permiso
   * que miente: se puede conceder y no sirve de nada. Hoy solo lo usa Configuración, por
   * `LABEL_MANAGE`.
   */
  requiresPermission?: PlatformPermission;
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
  // (QL-190) Asistente de IA. Gateado por `canUseAi()` en los consumidores del nav.
  { title: 'Asistente IA', url: '/ia', icon: Sparkles, requiresAi: true },
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
        // (QL-198b) También la ve quien tenga `LABEL_MANAGE` delegado: la pantalla contiene el
        // catálogo de Etiquetas, que ese permiso habilita a curar. La propia página filtra sus
        // tabs, así que un delegado solo ve "Etiquetas".
        title: 'Configuración',
        url: '/admin/configuracion',
        icon: SlidersHorizontal,
        adminOnly: true,
        requiresPermission: 'LABEL_MANAGE',
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
 * Lo que hace falta saber del usuario para decidir qué ítems se ven. Se resuelve **una vez** en
 * el consumidor (sidebar / bottom nav) y viaja como dato: la config no puede llamar hooks, y
 * duplicar el predicado en los dos consumidores es cómo se desincronizaron antes.
 */
export interface NavVisibilityContext {
  /** ADMIN o Dirección (`hasAtLeastRole(user,'MANAGER')`). */
  isAdmin: boolean;
  /** `canUseAi(user)`. */
  aiAllowed: boolean;
  /** `(permission) => hasPermission(user, permission)`. */
  hasPermission: (permission: PlatformPermission) => boolean;
}

/**
 * ¿Se le muestra este ítem al usuario? Fuente **única** del gate de navegación.
 *
 * `requiresPermission` **abre** el ítem: un `adminOnly` con permiso delegado lo ve tanto quien
 * llega por rol como quien lo tiene concedido en su perfil (QL-198b).
 */
export function isNavItemAllowed(item: NavItem, ctx: NavVisibilityContext): boolean {
  if (item.requiresAi && !ctx.aiAllowed) return false;
  if (item.requiresPermission && ctx.hasPermission(item.requiresPermission)) return true;
  return !item.adminOnly || ctx.isAdmin;
}

/** Hijos visibles de un grupo, ya filtrados por rol y permisos. */
export function visibleChildrenOf(
  item: NavItem,
  ctx: NavVisibilityContext,
): NavItem[] {
  return (item.children ?? []).filter((child) => isNavItemAllowed(child, ctx));
}

/**
 * ¿Se pinta este ítem de primer nivel? Igual que {@link isNavItemAllowed}, salvo que un **grupo**
 * también se muestra si le queda algún hijo visible: así un MEMBER con `LABEL_MANAGE` ve
 * "Administración" con solo "Configuración" dentro, sin abrirle el resto del área.
 */
export function isTopLevelNavItemVisible(
  item: NavItem,
  ctx: NavVisibilityContext,
): boolean {
  if (isNavItemAllowed(item, ctx)) return true;
  return visibleChildrenOf(item, ctx).length > 0;
}

/**
 * Aplana una lista de navegación expandiendo los grupos (`children`) en sus hojas (QL-149),
 * **consciente del rol y de los permisos** (QL-165, QL-198b). Lo usa el menú "Más" del bottom
 * nav, que es una lista plana.
 *
 * Por cada grupo se filtran los hijos:
 * - si quedan hijos visibles → se devuelven esos (el parent-contenedor se descarta, su `url` ya
 *   la cubre un hijo);
 * - si NO queda ninguno (un grupo cuyos hijos son todos `adminOnly`, visto por un MEMBER) → se
 *   devuelve el **parent** como link plano, para no perder la sección del menú.
 *
 * Los ítems sin hijos se mantienen tal cual. El filtro de los ítems de primer nivel lo sigue
 * aplicando el consumidor con {@link isTopLevelNavItemVisible}.
 */
export function flattenNavItems(
  items: NavItem[],
  ctx: NavVisibilityContext,
): NavItem[] {
  return items.flatMap((item) => {
    if (!item.children) return [item];
    const visibleChildren = visibleChildrenOf(item, ctx);
    return visibleChildren.length > 0 ? visibleChildren : [item];
  });
}
