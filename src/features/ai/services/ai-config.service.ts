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

/**
 * Una opción del listado de modelos (QL-194, §3.67). `source` dice de dónde salió: `catalog` lo
 * publica el motor (`model/list`) y **no se puede quitar**; `manual` lo añadió un ADMIN a mano y es
 * la única que ofrece el botón de quitar.
 */
export interface AiModelOption {
  /** Identificador que viaja en el `PATCH` (p. ej. `gpt-5.6-luna`). */
  id: string;
  /** Etiqueta legible del catálogo; en los `manual` es igual al `id`. */
  displayName: string;
  /** Descripción del catálogo; `''` en los `manual`. */
  description: string;
  source: 'catalog' | 'manual';
  /** Es el que usaría el plan de ChatGPT si nadie fuerza ninguno. */
  isPlanDefault: boolean;
}

/** De dónde sale el modelo que se está usando de verdad. `unknown` = el motor no respondió. */
export type AiModelEffectiveSource = 'configured' | 'planDefault' | 'unknown';

/**
 * Estado del modelo de IA de la plataforma (QL-194, §3.67). Lo devuelven **todos** los endpoints
 * del bloque `/ai/config/model*` y viaja además dentro de `GET /ai/config`.
 *
 * `configured` (lo que eligió el ADMIN; `null` = automático) y `effective` (el que se usará de
 * verdad) son cosas distintas y **no deben mezclarse en la UI**: divergen cuando el configurado
 * queda huérfano (`configuredAvailable: false`) y el backend cae al por defecto del plan.
 */
export interface AiModelState {
  configured: string | null;
  effective: string | null;
  effectiveSource: AiModelEffectiveSource;
  /** `false` = el configurado ya no existe en el catálogo → avisar y ofrecer volver a automático. */
  configuredAvailable: boolean;
  /** `false` = el motor no pudo servir el catálogo; el listado está incompleto, no vacío. */
  catalogAvailable: boolean;
  /** Unión de catálogo + listado manual. */
  available: AiModelOption[];
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
  /** Estado del modelo (QL-194, §3.67). Nunca `null`, aunque el motor esté caído. */
  model: AiModelState;
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

  /**
   * Estado del modelo (`GET /ai/config/models`). **Nunca da 503**: con el motor caído responde 200
   * con `catalogAvailable: false`, que es justo cuando hace falta poder arreglar la configuración.
   */
  getModels: () => api.get<AiModelState>('/ai/config/models'),

  /**
   * Elige el modelo activo (`PATCH /ai/config/model`). `null` es un valor de primera clase
   * ("automático / usa el del plan") y no consulta el catálogo, así que funciona con el motor caído.
   */
  setModel: (model: string | null) =>
    api.patch<AiModelState>('/ai/config/model', { model }),

  /**
   * Añade un id al listado manual (`POST /ai/config/models`, **200**, no 201). **Añadir no activa**:
   * activar es un `setModel` aparte.
   */
  addModel: (model: string) => api.post<AiModelState>('/ai/config/models', { model }),

  /**
   * Quita un modelo del listado manual (`DELETE /ai/config/models/:id`). Solo aplica a los
   * `source: 'manual'`; quitar el que está activo se rechaza con 409 `AI_MODEL_IN_USE`.
   */
  removeModel: (id: string) =>
    api.delete<AiModelState>(`/ai/config/models/${encodeURIComponent(id)}`),
};
