import { useEffect } from 'react';
import { useTheme } from 'next-themes';

/**
 * Mantiene `<meta name="theme-color">` sincronizado con el tema activo (QL-47).
 *
 * El tema lo gobierna next-themes por **clase** (`enableSystem={false}`), así que el meta
 * fijo del `index.html` dejaba la barra del SO azul también en oscuro. Aquí, en cada
 * cambio de `resolvedTheme`, leemos el color `primary` **del token del design system**
 * (`--primary`, ya resuelto por la clase `.dark`) y lo escribimos en el meta, sin inventar
 * hex nuevos. Los fallbacks solo aplican si el token no puede leerse.
 */
const FALLBACK_PRIMARY = {
  light: '#2160E8',
  dark: '#ff2d78',
} as const;

export function useThemeColorMeta(): void {
  const { resolvedTheme } = useTheme();

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
  }, [resolvedTheme]);
}
