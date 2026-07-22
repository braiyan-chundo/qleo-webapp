import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { clearImageCache } from '@/shared/lib/image-cache';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
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
