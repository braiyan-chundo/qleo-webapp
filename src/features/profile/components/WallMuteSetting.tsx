import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { User } from '@/store/auth.store';

import { useUpdateProfile } from '../hooks/use-profile';

interface WallMuteSettingProps {
  /** Perfil ya cargado por la página (`useMyProfile`); fuente de `wallPushMuted`. */
  user: User;
}

/**
 * Toggle "Silenciar muro corporativo" (QL-91, §3.15 `wallPushMuted`). Silencia el push
 * **genérico** de cada mensaje del muro; las @menciones siguen llegando (QL-88). Persiste
 * vía `PATCH /users/me` (`useUpdateProfile`) con actualización **optimista**: mientras
 * guarda muestra el valor pedido y un spinner; si falla, revierte y avisa por toast.
 */
export function WallMuteSetting({ user }: WallMuteSettingProps) {
  const update = useUpdateProfile();

  // Optimista sin escribir el caché a mano: durante el guardado refleja el valor enviado
  // (`variables`); al terminar/fallar cae al valor real del perfil (que onSuccess ya refresca).
  const muted = update.isPending
    ? (update.variables?.wallPushMuted ?? false)
    : (user.wallPushMuted ?? false);

  const handleChange = (checked: boolean) => {
    update.mutate(
      { wallPushMuted: checked },
      {
        onError: () => toast.error('No se pudo actualizar la preferencia del muro'),
      },
    );
  };

  return (
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="grid gap-1">
          <Label htmlFor="wall-mute-toggle" className="text-on-surface">
            Silenciar muro corporativo
          </Label>
          <p className="text-sm text-on-surface-variant">
            Dejarás de recibir la notificación de cada mensaje del muro. Las menciones
            seguirán llegando.
          </p>
        </div>

        <div className="flex items-center gap-2 pt-0.5">
          {update.isPending && (
            <Loader2 className="size-4 animate-spin text-on-surface-variant" />
          )}
          <Switch
            id="wall-mute-toggle"
            checked={muted}
            disabled={update.isPending}
            onCheckedChange={handleChange}
          />
        </div>
      </div>
    </div>
  );
}
