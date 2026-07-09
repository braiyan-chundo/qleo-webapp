import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Monitor, Moon, Sun } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

/**
 * Control de preferencia de tema para "Mi cuenta" (QL-34, ampliado en QL-76). Reutiliza la
 * lógica de `next-themes` (no sustituye al `ThemeToggle` de la topbar; es un control
 * equivalente dentro del perfil). Segmentado con 3 opciones: Claro, Oscuro y Sistema.
 *
 * El estado activo se lee de `theme` (la PREFERENCIA), no de `resolvedTheme`: con
 * `theme === 'system'` la opción activa es "Sistema" aunque el SO resuelva a oscuro.
 *
 * El tema es estado de UI puro (clase `.dark` en <html>); no hay estado de servidor aquí.
 */
const options = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Oscuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
] as const;

export function ThemePreference() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  // `theme` es `undefined` en el primer render (antes del efecto de next-themes). Sin este
  // flag, el grupo marcaría "Claro" por error y provocaría layout shift al hidratar.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const systemLabel =
    theme === 'system' && resolvedTheme
      ? `Actualmente: ${resolvedTheme === 'dark' ? 'oscuro' : 'claro'}`
      : null;

  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <Label className="text-on-surface">Tema de la aplicación</Label>
        <p className="text-sm text-on-surface-variant">
          Elige el tema claro u oscuro, o deja que &quot;Sistema&quot; siga la preferencia
          de tu dispositivo. Se aplica al instante.
        </p>
      </div>

      <div
        role="radiogroup"
        aria-label="Tema de la aplicación"
        className="flex w-full max-w-sm gap-1 rounded-xl border border-outline-variant/40 bg-surface-container-low p-1"
      >
        {options.map((option) => {
          const active = mounted && theme === option.value;
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTheme(option.value)}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                active
                  ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface',
              )}
            >
              <Icon className="size-4" />
              {option.label}
            </button>
          );
        })}
      </div>

      {systemLabel && (
        <p className="text-xs text-on-surface-variant">{systemLabel}</p>
      )}
    </div>
  );
}
