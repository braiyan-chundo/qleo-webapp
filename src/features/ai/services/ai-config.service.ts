import { api } from '@/core/api/fetch-client';

/**
 * Servicio de la **conexión IA de la plataforma** (QL-184/QL-185, contrato `docs/integracion/05-ia.md`).
 *
 * Enlaza **una sola** cuenta ChatGPT para todo Qleo vía **device login** (código + enlace). La
 * credencial no es una API key: es la sesión OAuth que `codex app-server` guarda en su `CODEX_HOME`.
 * `qleo-api` nunca ve ni devuelve token; solo expone metadatos de conexión. Todos los endpoints son
 * **solo ADMIN**. El fetch-client ya desenvuelve `{ success, data, error }`, así que aquí devolvemos `T`.
 */

/** Ventana de uso de la suscripción (badge de rate limit). `resetsAt` es epoch en **segundos**. */
export interface AiRateLimitWindow {
  usedPercent: number;
  resetsAt: number | null;
  windowMinutes: number | null;
}

/** Uso de la cuenta conectada; cualquiera de las ventanas (o el bloque entero) puede ser `null`. */
export interface AiRateLimits {
  primary: AiRateLimitWindow | null;
  secondary: AiRateLimitWindow | null;
}

/** Cuenta ChatGPT enlazada. `null` en `AiConfigResponse` cuando no hay conexión. */
export interface AiAccount {
  email: string | null;
  plan: string | null;
}

/** Quién dejó lista la conexión (metadato cacheado para el UX "otro admin ve que ya está"). */
export interface AiConnectedBy {
  userId: string;
  name: string;
}

/** Estado vivo de la conexión IA (`GET /ai/config`, `DELETE /ai/config`). */
export interface AiConfigResponse {
  /** Verdad viva (`account/read` del app-server), no solo el caché. */
  connected: boolean;
  account: AiAccount | null;
  /** ISO — cuándo se estableció (caché). */
  connectedAt: string | null;
  connectedBy: AiConnectedBy | null;
  rateLimits: AiRateLimits | null;
}

/** Datos del device login recién iniciado (`POST /ai/config/connect`). */
export interface AiConnectResponse {
  loginId: string;
  userCode: string;
  verificationUrl: string;
}

export const aiConfigService = {
  /** Estado de la conexión. Puede rechazar con 503 (`AI_ENGINE_UNAVAILABLE`/`AI_NOT_AUTHENTICATED`). */
  getConfig: () => api.get<AiConfigResponse>('/ai/config'),

  /** Inicia un device login: devuelve `userCode` + `verificationUrl` para autorizar fuera de banda. */
  connect: () => api.post<AiConnectResponse>('/ai/config/connect'),

  /** Cancela un intento de device login en curso (204, sin cuerpo). */
  cancelConnect: (loginId: string) =>
    api.post<void>('/ai/config/connect/cancel', { loginId }),

  /** Desconecta: cierra la sesión OAuth y limpia el caché. Devuelve el estado ya con `connected: false`. */
  disconnect: () => api.delete<AiConfigResponse>('/ai/config'),
};
