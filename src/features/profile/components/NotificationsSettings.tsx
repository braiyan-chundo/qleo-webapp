import { Loader2 } from 'lucide-react';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { usePush } from '@/features/push/hooks/use-push';

/**
 * Sección "Notificaciones" del perfil (QL-30, §3.17). Toggle de Web Push que consume
 * `usePush`. Refleja los estados del navegador con notas claras: no soportado (iOS sin
 * instalar / navegador viejo), permiso denegado, activando (busy) y activo.
 */
export function NotificationsSettings() {
  const { isSupported, permission, isSubscribed, isBusy, enable, disable } =
    usePush();

  const isDenied = permission === 'denied';
  // El switch se deshabilita si el dispositivo no soporta push, si el usuario bloqueó el
  // permiso, o mientras hay una operación en curso.
  const isDisabled = !isSupported || isDenied || isBusy;

  const handleChange = (checked: boolean) => {
    if (checked) {
      void enable();
    } else {
      void disable();
    }
  };

  return (
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="grid gap-1">
          <Label htmlFor="push-toggle" className="text-on-surface">
            Notificaciones push
          </Label>
          <p className="text-sm text-on-surface-variant">
            Recibe avisos de menciones y solicitudes de prórroga aunque tengas la
            pestaña cerrada.
          </p>
        </div>

        <div className="flex items-center gap-2 pt-0.5">
          {isBusy && (
            <Loader2 className="size-4 animate-spin text-on-surface-variant" />
          )}
          <Switch
            id="push-toggle"
            checked={isSubscribed}
            disabled={isDisabled}
            onCheckedChange={handleChange}
          />
        </div>
      </div>

      {!isSupported && (
        <p className="rounded-lg border border-outline-variant/40 bg-surface-container px-3 py-2 text-xs text-on-surface-variant">
          No disponible en este dispositivo. En iOS requiere instalar la app en la
          pantalla de inicio (iOS 16.4+).
        </p>
      )}

      {isSupported && isDenied && (
        <p className="rounded-lg border border-error/20 bg-error-container px-3 py-2 text-xs font-medium text-on-error-container">
          Has bloqueado las notificaciones en el navegador; actívalas desde los
          ajustes del sitio.
        </p>
      )}
    </div>
  );
}
