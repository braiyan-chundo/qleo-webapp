import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';

/**
 * Toggle binario claro/oscuro de la topbar. Fija SIEMPRE un tema explícito a partir de
 * `resolvedTheme`, así que al pulsarlo el usuario "sale" del modo Sistema (QL-76): el
 * comportamiento esperado para un interruptor rápido.
 *
 * Estado de UI puro: lo maneja next-themes (clase `.dark` en <html>).
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  // `resolvedTheme` es `undefined` hasta que next-themes monta; sin el guard renderizaría
  // un icono equivocado en el primer paint.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      aria-label={isDark ? 'Activar tema claro' : 'Activar tema oscuro'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low transition-colors"
    >
      {mounted && isDark ? (
        <Sun className="w-5 h-5 glow-text text-tertiary" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </button>
  );
}
