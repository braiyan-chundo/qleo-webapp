import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';

/**
 * Alterna entre el tema claro (Qleo Design System) y el oscuro (Neon Tokyo).
 * Estado de UI puro: lo maneja next-themes (clase `.dark` en <html>).
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      aria-label={isDark ? 'Activar tema claro' : 'Activar tema oscuro'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low transition-colors"
    >
      {isDark ? (
        <Sun className="w-5 h-5 glow-text text-tertiary" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </button>
  );
}
