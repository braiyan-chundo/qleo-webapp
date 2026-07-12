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
