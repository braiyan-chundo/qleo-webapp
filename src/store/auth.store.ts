import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
  status: 'ACTIVE' | 'INACTIVE';
  /** Fallback EXTERNO: URL de imagen pública (texto). Ausente si nunca se estableció. */
  avatarUrl?: string;
  /** QL-32: proxy privado del avatar SUBIDO (`/users/:id/avatar`), o `null` si no hay. */
  avatarDownloadUrl?: string | null;
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
      logout: () => set({ accessToken: null, user: null }),
      isAuthenticated: () => !!get().accessToken,
    }),
    {
      name: 'auth-storage', // name of the item in the storage (must be unique)
      partialize: (state) => ({ accessToken: state.accessToken, user: state.user }), // only persist token and user
    }
  )
);
