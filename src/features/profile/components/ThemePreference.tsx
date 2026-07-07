import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

/**
 * Control de preferencia de tema para "Mi cuenta" (QL-34). Reutiliza la misma lógica de
 * `next-themes` que el `ThemeToggle` de la topbar (no lo sustituye; es un control equivalente
 * dentro del perfil). Segmentado claro/oscuro para que la opción activa sea explícita.
 *
 * El tema es estado de UI puro (clase `.dark` en <html>); no hay estado de servidor aquí.
 */
export function ThemePreference() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const options = [
    { value: 'light', label: 'Claro', icon: Sun },
    { value: 'dark', label: 'Oscuro', icon: Moon },
  ] as const;

  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <Label className="text-on-surface">Tema de la aplicación</Label>
        <p className="text-sm text-on-surface-variant">
          Elige entre el tema claro y el oscuro. Se aplica al instante en este dispositivo.
        </p>
      </div>

      <div
        role="radiogroup"
        aria-label="Tema de la aplicación"
        className="flex w-full max-w-xs gap-1 rounded-xl border border-outline-variant/40 bg-surface-container-low p-1"
      >
        {options.map((option) => {
          const active =
            option.value === 'dark' ? isDark : !isDark;
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
    </div>
  );
}
