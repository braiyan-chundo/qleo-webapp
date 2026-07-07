import { BellRing, Loader2 } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { usePush } from '@/features/push/hooks/use-push';

/**
 * Banner superior (QL-46) que invita a activar las notificaciones push cuando el
 * navegador las soporta pero el usuario aún no está suscrito. Reutiliza `usePush`
 * (mismo estado/acciones que el toggle de `/profile`), sin duplicar lógica.
 *
 * Estados:
 * - No soportado o ya suscrito ⇒ no se muestra.
 * - Permiso denegado permanentemente ⇒ variante `warning` con texto de guía y botón
 *   deshabilitado (el permiso solo se recupera desde los ajustes del navegador).
 * - Soportado pero sin suscribir ⇒ CTA "Activar" que llama a `enable()`; al activarse,
 *   `isSubscribed` pasa a `true` y el banner desaparece.
 */
export function PushNotificationBanner() {
  const { isSupported, permission, isSubscribed, isBusy, enable } = usePush();

  if (!isSupported || isSubscribed) return null;

  const isDenied = permission === 'denied';

  return (
    <Alert
      variant="warning"
      className="flex items-center gap-3 rounded-none border-x-0 border-t-0 px-4 py-2.5 sm:px-6"
    >
      <BellRing className="size-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug">
          {isDenied
            ? 'Notificaciones bloqueadas en el navegador'
            : 'No tienes las notificaciones activas, puedes perderte información crucial.'}
        </p>
        {isDenied && (
          <p className="text-xs opacity-90">
            Actívalas desde los ajustes del sitio en tu navegador para no perderte
            avisos importantes.
          </p>
        )}
      </div>
      <Button
        size="sm"
        onClick={() => void enable()}
        disabled={isDenied || isBusy}
        className="shrink-0 bg-warning text-on-warning hover:bg-warning/90"
      >
        {isBusy && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
        {isBusy ? 'Activando…' : 'Activar'}
      </Button>
    </Alert>
  );
}
