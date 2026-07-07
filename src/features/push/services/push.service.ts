import { api } from '@/core/api/fetch-client';

/**
 * Servicio de notificaciones push / Web Push (QL-30, §3.17). Las 3 llamadas del contrato:
 * obtener la clave VAPID pública, suscribir este dispositivo y darlo de baja. Todo pasa por
 * el `fetch-client` (envelope `{ success, data, error }` ya desenvuelto); los métodos
 * devuelven `T` directo.
 */

/** Respuesta de `GET /push/vapid-public-key`. `publicKey` es `""` si el server no tiene VAPID. */
export interface VapidPublicKey {
  publicKey: string;
}

/**
 * Body de `POST /push/subscribe`. Coincide exactamente con lo que produce
 * `PushSubscription.toJSON()` (endpoint + claves de cifrado).
 */
export interface PushSubscriptionPayload {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/** Objeto `PushSubscription` que devuelve el backend (nunca incluye las `keys`). */
export interface PushSubscriptionResult {
  id: string;
  endpoint: string;
  userAgent: string | null;
  createdAt: string;
}

export const pushService = {
  /** Clave pública VAPID para `pushManager.subscribe({ applicationServerKey })`. */
  getVapidPublicKey: () => api.get<VapidPublicKey>('/push/vapid-public-key'),

  /** Registra (upsert idempotente) la suscripción de este dispositivo. */
  subscribe: (payload: PushSubscriptionPayload) =>
    api.post<PushSubscriptionResult>('/push/subscribe', payload),

  /**
   * Da de baja la suscripción por `endpoint`. Idempotente (204 sin body). El `endpoint` va
   * como query param: el `delete` del fetch-client no admite body (`data` omitido en su firma)
   * y el contrato acepta `body/query { endpoint }`.
   */
  unsubscribe: (endpoint: string) =>
    api.delete<void>(`/push/subscribe?endpoint=${encodeURIComponent(endpoint)}`),
};
