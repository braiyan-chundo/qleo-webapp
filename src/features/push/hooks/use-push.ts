import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { pushService } from '../services/push.service';
import { isPushSupported, urlBase64ToUint8Array } from '../lib/push-utils';

/**
 * Hook del feature Push (QL-30, §3.17). Expone el estado de las notificaciones push del
 * navegador y las acciones para activarlas/desactivarlas.
 *
 * Reparto de responsabilidades:
 * - La **clave VAPID** es dato de servidor cacheable ⇒ TanStack Query (`pushKeys.vapid`).
 * - La **suscripción actual** es estado del navegador (no de la API) ⇒ vive aquí con
 *   `useState`/`useEffect`, derivado de `pushManager.getSubscription()`.
 *
 * `enable()` debe invocarse desde un gesto del usuario (requisito de `requestPermission`).
 */

/** Claves de query del feature. */
export const pushKeys = {
  vapid: ['push', 'vapid-public-key'] as const,
};

/** Estado del permiso de notificaciones. `null` si el navegador no soporta la API. */
type PushPermission = NotificationPermission | null;

/** Tiempo máximo de espera a que el service worker esté listo antes de rendirse (ms). */
const SW_READY_TIMEOUT_MS = 8000;

/**
 * `navigator.serviceWorker.ready` con timeout (QL-35). Con `injectManifest`, si el SW no
 * llega a registrarse (p.ej. dev sin `devOptions`), esta promesa nunca resuelve y colgaba
 * `enable()`/`disable()`. Aquí la carrera contra un timeout garantiza que siempre termine.
 */
function serviceWorkerReady(): Promise<ServiceWorkerRegistration> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              'El service worker no se registró a tiempo. Recarga la página e inténtalo de nuevo.',
            ),
          ),
        SW_READY_TIMEOUT_MS,
      ),
    ),
  ]);
}

interface UsePushResult {
  /** El navegador soporta Web Push (SW + PushManager + Notification). */
  isSupported: boolean;
  /** `Notification.permission` (o `null` si no soportado). */
  permission: PushPermission;
  /**
   * Estado de la suscripción de este dispositivo en **tri-estado** (QL-46):
   * - `undefined` → **desconocido** (aún resolviendo `pushManager.getSubscription()`): los
   *   consumidores NO deben decidir nada todavía (evita el "flash" del banner al cargar).
   * - `false` → resuelto: no hay suscripción.
   * - `true` → resuelto: hay suscripción activa.
   */
  isSubscribed: boolean | undefined;
  /** Hay una operación de enable/disable en curso. */
  isBusy: boolean;
  /** Pide permiso y suscribe este dispositivo. Llamar desde un gesto del usuario. */
  enable: () => Promise<void>;
  /** Da de baja la suscripción de este dispositivo. */
  disable: () => Promise<void>;
}

export function usePush(): UsePushResult {
  const supported = isPushSupported();

  const [permission, setPermission] = useState<PushPermission>(
    supported ? Notification.permission : null,
  );
  // Tri-estado: `undefined` = aún no resuelto (no decidir nada mientras tanto).
  const [isSubscribed, setIsSubscribed] = useState<boolean | undefined>(undefined);
  const [isBusy, setIsBusy] = useState(false);

  // La clave VAPID solo hace falta para suscribir; se pide de forma perezosa y se cachea.
  const { refetch: refetchVapidKey } = useQuery({
    queryKey: pushKeys.vapid,
    queryFn: () => pushService.getVapidPublicKey(),
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  // Al montar, deriva el estado real de la suscripción del navegador (no solo del permiso).
  useEffect(() => {
    // Sin soporte no hay suscripción posible: resuelve el tri-estado a `false` (no `undefined`)
    // para que los consumidores controlados (p.ej. el switch de /profile) tengan un valor firme.
    if (!supported) {
      setIsSubscribed(false);
      return;
    }

    let cancelled = false;
    serviceWorkerReady()
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        if (!cancelled) setIsSubscribed(!!subscription);
      })
      .catch(() => {
        if (!cancelled) setIsSubscribed(false);
      });

    return () => {
      cancelled = true;
    };
  }, [supported]);

  const enable = useCallback(async () => {
    if (!supported || isBusy) return;

    setIsBusy(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== 'granted') {
        if (result === 'denied') {
          toast.error(
            'Has bloqueado las notificaciones. Actívalas desde los ajustes del sitio.',
          );
        }
        return;
      }

      const { data } = await refetchVapidKey();
      const publicKey = data?.publicKey;
      if (!publicKey) {
        toast.error('Las notificaciones push no están disponibles ahora mismo.');
        return;
      }

      const registration = await serviceWorkerReady();
      const applicationServerKey = urlBase64ToUint8Array(publicKey);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      // `toJSON()` produce exactamente el body del contrato (endpoint + keys); tipamos los
      // campos opcionales de `PushSubscriptionJSON` a lo que el navegador siempre entrega aquí.
      const json = subscription.toJSON();
      await pushService.subscribe({
        endpoint: json.endpoint ?? subscription.endpoint,
        keys: {
          p256dh: json.keys?.p256dh ?? '',
          auth: json.keys?.auth ?? '',
        },
      });

      setIsSubscribed(true);
      toast.success('Notificaciones push activadas.');
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'No se pudieron activar las notificaciones.',
      );
    } finally {
      setIsBusy(false);
    }
  }, [supported, isBusy, refetchVapidKey]);

  const disable = useCallback(async () => {
    if (!supported || isBusy) return;

    setIsBusy(true);
    try {
      const registration = await serviceWorkerReady();
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await pushService.unsubscribe(subscription.endpoint);
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      toast.success('Notificaciones push desactivadas.');
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'No se pudieron desactivar las notificaciones.',
      );
    } finally {
      setIsBusy(false);
    }
  }, [supported, isBusy]);

  return {
    isSupported: supported,
    permission,
    isSubscribed,
    isBusy,
    enable,
    disable,
  };
}
