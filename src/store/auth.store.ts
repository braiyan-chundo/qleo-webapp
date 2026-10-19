import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { queryClient } from '@/core/query/query-client';
import { clearImageCache } from '@/shared/lib/image-cache';

/**
 * QL-195 (§3.67) — Rol de **plataforma**. Son **jerárquicos**: `ADMIN` > `MANAGER` > `MEMBER`.
 *
 * | Valor | Etiqueta en la UI | Quién |
 * |---|---|---|
 * | `ADMIN` | Administrador | El usuario de **sistemas** |
 * | `MANAGER` | **Dirección** | La gerencia del Grupo Happy |
 * | `MEMBER` | Miembro | El resto |
 *
 * `MANAGER` se pinta **siempre** como «Dirección» (`USER_ROLE_LABEL` en
 * `@/shared/lib/permissions`): nunca «Manager» ni «Gerente». Hoy puede todo lo que puede un
 * ADMIN salvo enlazar/desenlazar la cuenta de ChatGPT; la separación existe para poder
 * divergir después.
 *
 * ⚠️ **Colisión de nombres:** `project.managerIds` (los gestores **de un proyecto**, QL-41) no
 * tiene nada que ver con este rol. Un gestor de proyecto suele ser un MEMBER, y un MANAGER no
 * aparece en `managerIds` de nada. Se leen igual y son cosas distintas.
 *
 * Nunca compares por igualdad (`role === 'ADMIN'`): usa `hasAtLeastRole` de
 * `@/shared/lib/permissions`, que es donde vive la jerarquía.
 */
export type UserRole = 'ADMIN' | 'MANAGER' | 'MEMBER';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'ACTIVE' | 'INACTIVE';
  /** Fallback EXTERNO: URL de imagen pública (texto). Ausente si nunca se estableció. */
  avatarUrl?: string;
  /**
   * QL-32: proxy privado del avatar SUBIDO, o `null` si no hay.
   *
   * (QL-182, §3.60) Llega **versionada** (`/users/:id/avatar?v=<hash>`): el `?v` cambia
   * exactamente cuando cambia la foto y es lo que hace segura la caché de 1 día. **Úsala tal
   * cual**: no la recortes, no le quites el query ni la reconstruyas a mano.
   */
  avatarDownloadUrl?: string | null;
  /**
   * QL-181 (§3.59): id del avatar del **catálogo global** que el usuario eligió, o `null`.
   * Solo sirve para **marcar** la opción seleccionada en el selector: la foto se pinta con
   * `avatarDownloadUrl` como cualquier otra (el backend copia el binario, no lo referencia).
   * Se limpia al subir una foto propia o al quitar el avatar. Si apunta a un id que ya no está
   * en el catálogo (el ADMIN lo borró), el selector simplemente no marca ninguna opción.
   */
  avatarCatalogId?: string | null;
  jobTitle?: string;
  /**
   * QL-193 (§3.66): fecha de nacimiento como **día civil** `'YYYY-MM-DD'` (sin hora ni zona),
   * o `null`. La edita el propio usuario (`PATCH /users/me`) o un ADMIN (`PATCH /users/:id`).
   *
   * Ojo: el backend la **enmascara** — solo la ve su dueño y un ADMIN. Un `null` significa
   * "no tienes permiso para ver el año", **no** "no tiene cumpleaños"; para eso están
   * `birthDay`/`birthMonth`. Nunca la conviertas con `new Date(...).toISOString()` (§3.66):
   * usa `@/shared/lib/civil-date`.
   */
  birthDate?: string | null;
  /** QL-193: día del mes de nacimiento (1–31), o `null` si no tiene fecha. Visible para todos. */
  birthDay?: number | null;
  /** QL-193: mes de nacimiento (1–12), o `null` si no tiene fecha. Visible para todos. */
  birthMonth?: number | null;
  /**
   * QL-88 (D2) / QL-91: push **genérico** del Muro Corporativo silenciado (default `false`).
   * Las @menciones del muro siguen llegando. Se togglea desde `/profile`.
   */
  wallPushMuted?: boolean;
  /**
   * QL-127: permiso **otorgado a un MEMBER** para crear proyectos (default `false`). Solo
   * un ADMIN lo concede desde la administración de usuarios (`PATCH /users/:id`).
   *
   * Ojo: **no** es el permiso efectivo. Un ADMIN siempre puede crear proyectos aunque este
   * flag sea `false`. Para decidir en la UI usa `canCreateProjects()` de
   * `@/shared/lib/permissions`, nunca este campo suelto.
   */
  canCreateProjects?: boolean;
  /**
   * QL-184: permiso de plataforma para usar el **panel de IA** (default **`true`**, al revés que
   * `canCreateProjects`). Un ADMIN lo **revoca** a un MEMBER desde la administración de usuarios.
   *
   * Ojo: **no** es el permiso efectivo. Un ADMIN siempre puede usar la IA aunque el flag falte o
   * sea `false`, y los usuarios antiguos sin el campo salen con acceso. Para decidir en la UI usa
   * `canUseAi()` de `@/shared/lib/permissions` (que resuelve el `?? true`), nunca este campo suelto.
   */
  canUseAi?: boolean;
  /**
   * QL-198 (§3.70): id del **perfil de permisos** asignado, o `null`. Un solo perfil por usuario
   * (decisión de producto, no limitación temporal): con uno, "¿qué puede hacer Juan?" se responde
   * mirando una cosa. Se asigna con `PATCH /users/:id`; no es self-service.
   */
  profileId?: string | null;
  /**
   * QL-198 (§3.70): resumen del perfil asignado, **para pintar** (nombre, chips), o `null`.
   *
   * ⚠️ **No decidas permisos con `profile.permissions`**: dejaría fuera el rol y los flags
   * individuales. Para eso está `effectivePermissions`. Puede llegar con `active: false` (perfil
   * retirado): el usuario conserva la asignación pero ya **no** recibe sus permisos.
   */
  profile?: {
    id: string;
    name: string;
    permissions: string[];
    active: boolean;
  } | null;
  /**
   * QL-198 (§3.70): permisos efectivos **ya calculados por el backend** — la unión de lo que
   * conceden el rol, los flags individuales y el perfil activo. Es lo que decide en la UI; se lee
   * con `hasPermission()` de `@/shared/lib/permissions`, nunca a mano.
   *
   * Tipado como `string[]` a propósito: el catálogo crece en el backend y una clave que el front
   * aún no conoce debe viajar sin romper el parseo.
   *
   * Puede faltar en una sesión **persistida antes de QL-198** (el store va a localStorage); el
   * helper resuelve ese hueco con la regla anterior hasta el primer `GET /auth/me`.
   */
  effectivePermissions?: string[];
  /**
   * QL-153: token de la paleta curada para el color primary en modo **claro**. `null`/ausente
   * = genérico (sin preferencia). El backend solo persiste la clave (string corto, p. ej.
   * `'violet'`); el mapeo token→tokens Material 3 lo posee el front (`features/profile/lib/theme-palette`).
   */
  themePrimaryLight?: string | null;
  /** QL-153: token de la paleta curada para el color primary en modo **oscuro**. `null` = genérico. */
  themePrimaryDark?: string | null;
}

interface AuthState {
  accessToken: string | null;
  user: User | null;
  setCredentials: (token: string, user: User) => void;
  setUser: (user: User) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      user: null,
      setCredentials: (token, user) => set({ accessToken: token, user }),
      setUser: (user) => set({ user }),
      logout: () => {
        set({ accessToken: null, user: null });
        // Privacidad en equipo compartido (O-4 de HU-0202): sin esto, quien entre después en la
        // misma pestaña ve, mientras dure la caché, los datos del usuario que sale (sus
        // recordatorios privados, sus notificaciones). `clear()` también cancela las peticiones en
        // vuelo, para que una respuesta tardía no repueble la caché del siguiente. Va tras el
        // `set`: las queries que siguen montadas al salir dependen de `!!token` y no re-piden.
        queryClient.clear();
        // (QL-182, §3.60) Privacidad en equipo compartido: la caché del SW se indexa por URL,
        // así que hay que vaciar las imágenes cacheadas del usuario que sale. Best-effort,
        // fire-and-forget: no debe bloquear el cierre de sesión. Cubre todas las vías de logout
        // (menú de usuario y 401 global), que confluyen aquí.
        void clearImageCache();
      },
      isAuthenticated: () => !!get().accessToken,
    }),
    {
      name: 'auth-storage', // name of the item in the storage (must be unique)
      partialize: (state) => ({ accessToken: state.accessToken, user: state.user }), // only persist token and user
    }
  )
);
