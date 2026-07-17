import { Check, Loader2, Moon, Sun } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import type { User } from '@/store/auth.store';

import type { UpdateMePayload } from '../services/profile.service';
import { useUpdateProfile } from '../hooks/use-profile';
import {
  getPaletteOption,
  PALETTE_OPTIONS,
  type PaletteOption,
} from '../lib/theme-palette';

/**
 * QL-153 — "Color de la aplicación": el usuario elige SU color primary para modo **claro** y
 * **oscuro** de una paleta curada, con **preview en vivo**. Cada selector pinta las muestras
 * (swatches) de la paleta con su color real (aunque el modo activo sea el otro) y marca la activa.
 *
 * Al elegir, persiste con `PATCH /users/me` (`useUpdateProfile`) mandando **solo** el campo que
 * cambia; la opción "Genérico" manda `null` para resetear. `onSuccess` refresca el store con el
 * `User` devuelto y el applier (`useApplyUserTheme`, montado en `AppLayout`) reaplica al instante.
 */

type Mode = 'light' | 'dark';

interface ModeSelectorProps {
  mode: Mode;
  /** Token persistido para este modo (o null = genérico). */
  storedToken: string | null | undefined;
  /** Token que se está guardando ahora mismo (optimista), o `undefined` si no hay guardado en curso. */
  pendingToken: string | null | undefined;
  isPending: boolean;
  onSelect: (token: string | null) => void;
}

/** Muestra de color de una opción para un modo (usa los hex de la propia paleta). */
function Swatch({ option, mode }: { option: PaletteOption; mode: Mode }) {
  const tokens = mode === 'dark' ? option.dark : option.light;
  return (
    <span
      aria-hidden
      className="size-6 rounded-full border border-outline-variant/50"
      style={{
        background: `linear-gradient(135deg, ${tokens['--primary']} 0 60%, ${tokens['--primary-container']} 60% 100%)`,
      }}
    />
  );
}

function ModeSelector({
  mode,
  storedToken,
  pendingToken,
  isPending,
  onSelect,
}: ModeSelectorProps) {
  // Token efectivo mostrado como activo: durante un guardado refleja el pedido (optimista);
  // si el token persistido es desconocido, cae a "Genérico" (null), coherente con el applier.
  const effectiveToken = isPending ? pendingToken : storedToken;
  const activeToken = getPaletteOption(effectiveToken) ? effectiveToken : null;

  const Icon = mode === 'dark' ? Moon : Sun;
  const modeLabel = mode === 'dark' ? 'Oscuro' : 'Claro';

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-on-surface-variant" />
        <Label className="text-sm text-on-surface">Modo {modeLabel.toLowerCase()}</Label>
        {isPending && (
          <Loader2 className="size-3.5 animate-spin text-on-surface-variant" />
        )}
      </div>

      <div
        role="radiogroup"
        aria-label={`Color primary en modo ${modeLabel.toLowerCase()}`}
        className="flex flex-wrap gap-2"
      >
        {PALETTE_OPTIONS.map((option) => {
          const active = activeToken === option.token;
          return (
            <button
              key={option.token ?? '__generic__'}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={isPending}
              title={option.label}
              onClick={() => onSelect(option.token)}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60',
                active
                  ? 'border-primary bg-surface-container text-on-surface'
                  : 'border-outline-variant/40 bg-surface-container-low text-on-surface-variant hover:text-on-surface',
              )}
            >
              <Swatch option={option} mode={mode} />
              <span>{option.label}</span>
              {active && <Check className="size-3.5 text-primary" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface ThemeColorSettingProps {
  /** Perfil ya cargado por la página (`useMyProfile`); fuente de los tokens elegidos. */
  user: User;
}

export function ThemeColorSetting({ user }: ThemeColorSettingProps) {
  const update = useUpdateProfile();

  const handleSelect = (mode: Mode, token: string | null) => {
    const payload: UpdateMePayload =
      mode === 'dark' ? { themePrimaryDark: token } : { themePrimaryLight: token };
    update.mutate(payload, {
      onError: () => toast.error('No se pudo actualizar el color de la aplicación'),
    });
  };

  // Solo hay un guardado en curso a la vez; localizamos a qué modo pertenece por el campo enviado.
  const pendingLight =
    update.isPending && 'themePrimaryLight' in (update.variables ?? {});
  const pendingDark =
    update.isPending && 'themePrimaryDark' in (update.variables ?? {});

  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <Label className="text-on-surface">Color de la aplicación</Label>
        <p className="text-sm text-on-surface-variant">
          Elige tu color principal para cada modo. Solo afecta a tu sesión y se aplica al
          instante. &quot;Genérico&quot; usa el color por defecto de Qleo.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <ModeSelector
          mode="light"
          storedToken={user.themePrimaryLight}
          pendingToken={update.variables?.themePrimaryLight}
          isPending={pendingLight}
          onSelect={(token) => handleSelect('light', token)}
        />
        <ModeSelector
          mode="dark"
          storedToken={user.themePrimaryDark}
          pendingToken={update.variables?.themePrimaryDark}
          isPending={pendingDark}
          onSelect={(token) => handleSelect('dark', token)}
        />
      </div>
    </div>
  );
}
