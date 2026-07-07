---
name: react-state-zustand
description: >
  Cómo manejar estado de CLIENTE en qleo-webapp con Zustand v5: stores con `persist`,
  selectores, acciones, y la frontera clave entre estado de cliente (Zustand) y estado
  de servidor (TanStack Query). Usa esta habilidad para sesión/auth, preferencias de UI
  o estado global efímero. NO para datos que vienen de la API.
---

# Estado de Cliente — Zustand (qleo-webapp)

## Frontera cliente vs servidor (CRÍTICO)
- **Zustand** = estado de **cliente**: token de sesión, usuario actual, tema, estado de
  UI global (sidebar abierto, filtros persistentes...).
- **TanStack Query** = estado de **servidor**: proyectos, tareas, notificaciones, etc.
  **Nunca** copies datos de la API a un store de Zustand; consúmelos con hooks de query.

## Store estándar (`store/<x>.store.ts`)
Ejemplo real: `store/auth.store.ts`.
```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
      name: 'auth-storage',
      partialize: (s) => ({ accessToken: s.accessToken, user: s.user }),
    },
  ),
);
```

## Consumo con selectores
Selecciona **solo lo que usas** para evitar renders de más:
```ts
const user = useAuthStore((s) => s.user);
const logout = useAuthStore((s) => s.logout);
```
Fuera de React (ej. el fetch-client) usa `useAuthStore.getState()`.

## Reglas
- Un store por dominio de estado de cliente; mantenlos pequeños.
- `persist` solo para lo que debe sobrevivir recargas (sesión, tema). Usa `partialize`.
- Acciones dentro del store; nada de `setState` disperso por componentes.
- El store de auth es la fuente del token que lee el fetch-client y `ProtectedRoute`.
