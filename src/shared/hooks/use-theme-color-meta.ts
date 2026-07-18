import { useEffect } from 'react';
import { useTheme } from 'next-themes';

import { useAuthStore } from '@/store/auth.store';

/**
 * Mantiene `<meta name="theme-color">` sincronizado con el tema activo (QL-47).
 *
 * El tema lo gobierna next-themes por **clase**, así que el meta fijo del `index.html`
 * dejaba la barra del SO con un color equivocado al cambiar de tema. Aquí, en cada cambio
 * de `resolvedTheme`, leemos el color `primary` **del token del design system**
 * (`--primary`, ya resuelto por la clase `.dark`) y lo escribimos en el meta, sin inventar
 * hex nuevos. Los fallbacks solo aplican si el token no puede leerse.
 *
 * QL-75: el arranque (recarga dura) ya lo cubre el script inline pre-paint de `index.html`;
 * este hook sigue siendo necesario para los cambios de tema **en caliente** (toggle,
 * opción "Sistema" siguiendo al SO) que ocurren después de montar React.
 *
 * QL-155: el color primary por usuario (QL-153) se inyecta inline en `<html>` por el applier
 * (`useApplyUserTheme`), y el meta lee `--primary` **computado**. Ese cambio de preferencia no
 * altera `resolvedTheme`, así que el efecto también observa `themePrimaryLight/Dark` del usuario
 * en sesión: al cambiar el primary elegido, el meta se recomputa y la barra del SO/PWA hereda el
 * nuevo color (antes se quedaba con el primary anterior). El applier corre en un hijo (`AppLayout`)
 * respecto a este hook (`App`), y además el rAF difiere la lectura a después del commit, así que
 * `getComputedStyle` ya ve el `--primary` recién inyectado.
 */
const FALLBACK_PRIMARY = {
  light: '#004ccd',
  dark: '#ff2d78',
} as const;

export function useThemeColorMeta(): void {
  const { resolvedTheme } = useTheme();
  const themePrimaryLight = useAuthStore((s) => s.user?.themePrimaryLight);
  const themePrimaryDark = useAuthStore((s) => s.user?.themePrimaryDark);

  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    );
    if (!meta) return;

    // El efecto de next-themes que aplica la clase `.dark` en <html> corre en el
    // ThemeProvider (padre) después de este efecto (hijo) dentro del mismo commit; leer
    // el token de forma síncrona devolvería el color del tema anterior. Con un rAF leemos
    // ya aplicada la clase, y así `--primary` resuelve al valor del tema activo.
    const raf = requestAnimationFrame(() => {
      const token = getComputedStyle(document.documentElement)
        .getPropertyValue('--primary')
        .trim();

      const fallback =
        resolvedTheme === 'dark'
          ? FALLBACK_PRIMARY.dark
          : FALLBACK_PRIMARY.light;

      meta.setAttribute('content', token || fallback);
    });

    return () => cancelAnimationFrame(raf);
  }, [resolvedTheme, themePrimaryLight, themePrimaryDark]);
}
