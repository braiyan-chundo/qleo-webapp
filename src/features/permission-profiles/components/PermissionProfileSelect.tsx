import { useMemo } from 'react';

import { Label } from '@/components/ui/label';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';

import { usePermissionProfiles } from '../hooks/use-permission-profiles';

/** Valor del selector cuando la persona no tiene perfil. `''` ⇄ `profileId: null`. */
export const NO_PROFILE = '';

interface PermissionProfileSelectProps {
  id?: string;
  /** Id del perfil elegido, o `''` para "Sin perfil". */
  value: string;
  onChange: (profileId: string) => void;
  /**
   * Perfil que el usuario tiene guardado. Se conserva como opción aunque esté **retirado**: si no,
   * abrir la ficha de alguien con un perfil retirado dejaría el selector en "Sin perfil" y
   * guardar se lo quitaría sin que nadie lo pidiera.
   */
  currentProfile?: { id: string; name: string; active: boolean } | null;
  disabled?: boolean;
}

/**
 * QL-198 (§3.70 §3) — Selector **simple** de perfil de permisos. Nunca multi-select: un solo
 * perfil por usuario es deliberado, para que "¿qué puede hacer Juan?" se responda mirando una
 * cosa. Si hace falta una combinación, se crea un perfil que la contenga.
 *
 * Solo ofrece perfiles **activos** (asignar uno retirado da 409 `PERMISSION_PROFILE_INACTIVE`),
 * más el que la persona ya tenga, marcado como retirado.
 */
export function PermissionProfileSelect({
  id = 'profileId',
  value,
  onChange,
  currentProfile,
  disabled,
}: PermissionProfileSelectProps) {
  const { data: profiles, isLoading } = usePermissionProfiles();

  const options = useMemo(() => {
    const active = profiles ?? [];
    // El perfil guardado no aparece en la lista de activos si lo retiraron: se añade a mano.
    if (currentProfile && !active.some((p) => p.id === currentProfile.id)) {
      return [
        ...active.map((p) => ({ id: p.id, name: p.name, active: p.active })),
        { id: currentProfile.id, name: currentProfile.name, active: currentProfile.active },
      ];
    }
    return active.map((p) => ({ id: p.id, name: p.name, active: p.active }));
  }, [profiles, currentProfile]);

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-on-surface">
        Perfil de permisos
      </Label>
      <NativeSelect
        id={id}
        className="w-full [&>select]:h-10"
        value={value}
        disabled={disabled || isLoading}
        onChange={(e) => onChange(e.target.value)}
      >
        <NativeSelectOption value={NO_PROFILE}>
          {isLoading ? 'Cargando perfiles…' : 'Sin perfil'}
        </NativeSelectOption>
        {options.map((profile) => (
          <NativeSelectOption key={profile.id} value={profile.id}>
            {profile.name}
            {profile.active ? '' : ' (retirado — no concede nada)'}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <span className="text-xs text-on-surface-variant">
        El perfil <strong>suma</strong> a los permisos de abajo: quitarlo no revoca lo que esté
        concedido individualmente.
      </span>
    </div>
  );
}
