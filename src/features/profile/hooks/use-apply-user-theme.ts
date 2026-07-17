import { useEffect } from 'react';
import { useTheme } from 'next-themes';

import { useAuthStore } from '@/store/auth.store';
import {
  getPaletteOption,
  type PrimaryTokens,
} from '../lib/theme-palette';

/**
 * QL-153 — Applier del color primary elegido por el usuario (claro/oscuro).
 *
 * Lee `themePrimaryLight`/`themePrimaryDark` del usuario en sesión (store) y el modo activo
 * real de next-themes (`resolvedTheme`, resuelve `system` → `'light'`/`'dark'`). Según el modo
 * activo resuelve el token a su set de 4 tokens M3 y los inyecta como **propiedades inline** en
 * `document.documentElement.style`: inline gana por especificidad a `:root` y a `.dark`, y el
 * resto de tokens derivados (`--ring`, `--accent`, `--sidebar-primary`…) cascadean solos.
 *
 * Si el token es `null` o **desconocido** (no está en la paleta), **elimina** las inline props
 * para volver a los genéricos de `index.css`. También limpia al hacer logout / cambiar de usuario
 * (el efecto vuelve a correr y, sin user, borra las props → no queda pegado el color anterior).
 *
 * Se monta alto en el árbol (dentro del ThemeProvider y con sesión: `AppLayout`). Aplica en
 * `useEffect` en cuanto haya `resolvedTheme`; el arranque general del tema lo cubre next-themes,
 * así que el FOUC es mínimo (solo el primer paint tras hidratar la sesión).
 */

const MANAGED_PROPS: Array<keyof PrimaryTokens> = [
  '--primary',
  '--on-primary',
  '--primary-container',
  '--on-primary-container',
];

function clearUserTheme(root: HTMLElement) {
  for (const prop of MANAGED_PROPS) {
    root.style.removeProperty(prop);
  }
}

export function useApplyUserTheme() {
  const themePrimaryLight = useAuthStore((s) => s.user?.themePrimaryLight);
  const themePrimaryDark = useAuthStore((s) => s.user?.themePrimaryDark);
  const hasUser = useAuthStore((s) => !!s.user);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const root = document.documentElement;

    // Sin sesión o sin modo resuelto todavía: no dejamos color pegado.
    if (!hasUser || !resolvedTheme) {
      clearUserTheme(root);
      return;
    }

    const token = resolvedTheme === 'dark' ? themePrimaryDark : themePrimaryLight;
    const option = getPaletteOption(token);

    // Genérico o token desconocido → volver a la cascada nativa de index.css.
    if (!option) {
      clearUserTheme(root);
      return;
    }

    const tokens = resolvedTheme === 'dark' ? option.dark : option.light;
    for (const prop of MANAGED_PROPS) {
      root.style.setProperty(prop, tokens[prop]);
    }
  }, [hasUser, resolvedTheme, themePrimaryLight, themePrimaryDark]);
}
